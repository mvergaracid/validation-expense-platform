import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  ParseUUIDPipe,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UploadStorageService } from './upload-storage.service';
import { IngestorClient } from './ingestor.client';
import { FileProcessEntity } from '../persistence/file-process.entity';
import { FileProcessBatchEntity } from '../persistence/file-process-batch.entity';
import { JobRunEntity } from '../persistence/job-run.entity';
import { JobRunStageEntity } from '../persistence/job-run-stage.entity';
import { ExpenseEntity } from '../persistence/expense.entity';
import PDFDocument from 'pdfkit';
import { ValidationPolicyEntity } from '../persistence/validation-policy.entity';
import Redis from 'ioredis';

@Controller()
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private readonly storage: UploadStorageService,
    private readonly ingestor: IngestorClient,
    @InjectRepository(FileProcessEntity)
    private readonly processes: Repository<FileProcessEntity>,
    @InjectRepository(FileProcessBatchEntity)
    private readonly batches: Repository<FileProcessBatchEntity>,
    @InjectRepository(JobRunEntity)
    private readonly jobRuns: Repository<JobRunEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(ValidationPolicyEntity)
    private readonly policies: Repository<ValidationPolicyEntity>,
  ) {}

  private async resolveCurrentPolicy(): Promise<Record<string, unknown> | null> {
    const entity = await this.policies.findOne({ where: { name: 'current' } });
    if (entity) return entity.policies;

    const raw = process.env.DEFAULT_POLICIES;
    if (!raw) return null;

    return JSON.parse(raw) as Record<string, unknown>;
  }

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file?: Express.Multer.File): Promise<{ processId: string }> {
    if (!file) {
      throw new BadRequestException('file es requerido');
    }

    const originalName = file.originalname || 'upload.csv';
    if (!originalName.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('El archivo debe ser .csv');
    }

    const saved = await this.storage.saveCsv(file);
    return this.ingestor.startIngestion({ storageUri: saved.storageUri, filename: originalName });
  }

  @Get('processes/:processId')
  async getProcess(
    @Param('processId', new ParseUUIDPipe({ version: '4' })) processId: string,
  ): Promise<
    FileProcessEntity & {
      processed_records: number;
      pending_records: number;
      rejected_records: number;
      skipped_records: number;
      negative_records: number;
      duplicate_records: number;
    }
  > {
    const entity = await this.processes.findOne({ where: { process_id: processId } });
    if (!entity) {
      throw new BadRequestException('processId no encontrado');
    }

    const qb = this.jobRuns.createQueryBuilder('jr').where("jr.meta ->> 'processId' = :processId", { processId });

    const processed_records = await qb.clone().andWhere("jr.status = 'success'").getCount();

    const skipped_records = await qb.clone().andWhere("jr.status = 'skipped'").getCount();

    const validationStatusExpr =
      "UPPER(COALESCE(e.validation_status, jr.meta -> 'validation' ->> 'status', 'PENDIENTE'))";
    const pending_records = await qb
      .clone()
      .leftJoin(ExpenseEntity, 'e', 'e.job_id = jr.job_id')
      .andWhere("jr.status = 'success'")
      .andWhere(`${validationStatusExpr} = 'PENDIENTE'`)
      .getCount();

    const rejected_records = await qb
      .clone()
      .leftJoin(ExpenseEntity, 'e', 'e.job_id = jr.job_id')
      .andWhere("jr.status = 'success'")
      .andWhere(`${validationStatusExpr} = 'RECHAZADO'`)
      .getCount();

    const negative_records = await qb
      .clone()
      .andWhere("jr.status = 'skipped'")
      .andWhere("jr.meta ? 'negative_amount'")
      .getCount();

    const duplicateReasons = ['duplicate_fingerprint', 'duplicate_fingerprint_db'];
    const duplicate_records = await qb
      .clone()
      .andWhere("jr.status = 'skipped'")
      .andWhere("jr.meta ? 'dedup'")
      .andWhere("(jr.meta -> 'dedup' ->> 'reason') IN (:...reasons)", { reasons: duplicateReasons })
      .getCount();

    return {
      ...entity,
      processed_records,
      pending_records,
      rejected_records,
      skipped_records,
      negative_records,
      duplicate_records,
    };
  }

  @Get('processes/:processId/audit')
  async getProcessAudit(
    @Param('processId', new ParseUUIDPipe({ version: '4' })) processId: string,
    @Query('kind') kind?: 'duplicate' | 'negative',
  ): Promise<{
    items: Array<{
      job_id: string;
      expense_id: string | null;
      fingerprint: string | null;
      created_at: string;
      meta: Record<string, unknown> | null;
      expense_fecha: string | null;
      expense_moneda_original: string | null;
      expense_monto_original: string | null;
      expense_validation_status: string | null;
    }>;
  }> {
    const entity = await this.processes.findOne({ where: { process_id: processId } });
    if (!entity) {
      throw new BadRequestException('processId no encontrado');
    }

    if (kind !== 'duplicate' && kind !== 'negative') {
      throw new BadRequestException('kind inválido (duplicate|negative)');
    }

    const qb = this.jobRuns
      .createQueryBuilder('jr')
      .leftJoin(ExpenseEntity, 'e', 'e.job_id = jr.job_id')
      .where("jr.meta ->> 'processId' = :processId", { processId })
      .andWhere("jr.status = 'skipped'");

    if (kind === 'negative') {
      qb.andWhere("jr.meta ? 'negative_amount'");
    }

    if (kind === 'duplicate') {
      const duplicateReasons = ['duplicate_fingerprint', 'duplicate_fingerprint_db'];
      qb.andWhere("jr.meta ? 'dedup'")
        .andWhere("(jr.meta -> 'dedup' ->> 'reason') IN (:...reasons)", { reasons: duplicateReasons });
    }

    const raw = await qb
      .orderBy('jr.created_at', 'DESC')
      .limit(500)
      .select([
        'jr.job_id as job_id',
        'jr.expense_id as expense_id',
        'jr.fingerprint as fingerprint',
        'jr.created_at as created_at',
        'jr.meta as meta',
        'e.fecha as expense_fecha',
        'e.moneda_original as expense_moneda_original',
        'e.monto_original as expense_monto_original',
        'e.validation_status as expense_validation_status',
      ])
      .getRawMany<{
        job_id: string;
        expense_id: string | null;
        fingerprint: string | null;
        created_at: Date;
        meta: Record<string, unknown> | null;
        expense_fecha: string | null;
        expense_moneda_original: string | null;
        expense_monto_original: string | null;
        expense_validation_status: string | null;
      }>();

    return {
      items: raw.map((r) => ({
        job_id: r.job_id,
        expense_id: r.expense_id,
        fingerprint: r.fingerprint,
        created_at: r.created_at.toISOString(),
        meta: r.meta,
        expense_fecha: r.expense_fecha,
        expense_moneda_original: r.expense_moneda_original,
        expense_monto_original: r.expense_monto_original,
        expense_validation_status: r.expense_validation_status,
      })),
    };
  }

  @Get('processes/:processId/report.pdf')
  async downloadProcessReportPdf(
    @Param('processId', new ParseUUIDPipe({ version: '4' })) processId: string,
    @Res() res: Response,
  ): Promise<void> {
    const entity = await this.processes.findOne({ where: { process_id: processId } });
    if (!entity) {
      throw new BadRequestException('processId no encontrado');
    }

    const currentPolicy = await this.resolveCurrentPolicy();

    const maxRows = Math.min(Math.max(Number(process.env.REPORT_MAX_ROWS ?? 2000) || 2000, 1), 20000);

    const rawRows = await this.jobRuns
      .createQueryBuilder('jr')
      .leftJoin(ExpenseEntity, 'e', 'e.job_id = jr.job_id')
      .where("jr.meta ->> 'processId' = :processId", { processId })
      .orderBy('jr.created_at', 'ASC')
      .limit(maxRows)
      .select([
        'jr.job_id as job_id',
        'jr.status as job_status',
        'jr.meta as job_meta',
        'e.id as expense_id',
        'e.fecha as expense_fecha',
        'e.moneda_original as expense_moneda_original',
        'e.monto_original as expense_monto_original',
        'e.categoria as expense_categoria',
        'e.cost_center as expense_cost_center',
        'e.validation_status as expense_validation_status',
      ])
      .getRawMany<{
        job_id: string;
        job_status: string;
        job_meta: Record<string, unknown> | null;
        expense_id: string | null;
        expense_fecha: string | null;
        expense_moneda_original: string | null;
        expense_monto_original: string | null;
        expense_categoria: string | null;
        expense_cost_center: string | null;
        expense_validation_status: string | null;
      }>();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="process-${processId}.pdf"`);

    const doc = new PDFDocument({ size: 'Letter', margin:  20 });
    doc.pipe(res);

    doc.fontSize(18).text('Reporte de Proceso', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`processId: ${processId}`);
    doc.text(`filename: ${entity.filename}`);
    doc.text(`status: ${entity.status}`);
    doc.text(`total_records: ${entity.total_records}`);
    doc.text(`published_batches: ${entity.published_batches}`);
    doc.text(`created_at: ${entity.created_at.toISOString()}`);
    if (entity.finished_at) {
      doc.text(`finished_at: ${entity.finished_at.toISOString()}`);
    }
    doc.moveDown(1);

    doc.fontSize(12).text('Policy aplicada', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);
    doc.text(currentPolicy ? JSON.stringify(currentPolicy, null, 2) : 'No hay policy disponible (DB/env).', {
      width: 515,
    });

    doc.addPage();
    doc.fontSize(12).text('Gastos y resultados', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).text(`Filas incluidas: ${rawRows.length} (límite: ${maxRows})`);
    doc.moveDown(0.8);

    const columns = [
      { key: 'id', label: 'ID', width: 70 },
      { key: 'fecha', label: 'Fecha', width: 70 },
      { key: 'moneda', label: 'Moneda', width: 55 },
      { key: 'monto', label: 'Monto', width: 60 },
      { key: 'categoria', label: 'Categoría', width: 80 },
      { key: 'cost_center', label: 'C.Costo', width: 90 },
      { key: 'resultado', label: 'Resultado', width: 70 },
    ] as const;

    const startX = doc.x;
    const rowHeight = 14;

    const drawRow = (values: Record<string, string>, y: number, header = false) => {
      let x = startX;
      doc.font(header ? 'Helvetica-Bold' : 'Helvetica');
      for (const col of columns) {
        doc.text(values[col.key] ?? '', x, y, { width: col.width, ellipsis: true });
        x += col.width;
      }
      doc.font('Helvetica');
    };

    drawRow(
      {
        id: 'ID',
        fecha: 'Fecha',
        moneda: 'Moneda',
        monto: 'Monto',
        categoria: 'Categoría',
        cost_center: 'C.Costo',
        resultado: 'Resultado',
      },
      doc.y,
      true,
    );

    let y = doc.y + rowHeight;
    doc.moveTo(startX, y - 2).lineTo(startX + columns.reduce((s, c) => s + c.width, 0), y - 2).stroke();

    for (const r of rawRows) {
      if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
        doc.addPage();
        y = doc.y;
        drawRow(
          {
            id: 'ID',
            fecha: 'Fecha',
            moneda: 'Moneda',
            monto: 'Monto',
            categoria: 'Categoría',
            cost_center: 'C.Costo',
            resultado: 'Resultado',
          },
          y,
          true,
        );
        y += rowHeight;
      }

      const meta = (r.job_meta ?? {}) as any;

      const id = r.expense_id ?? (typeof meta.id === 'string' ? meta.id : r.job_id);
      const fecha = r.expense_fecha ?? (typeof meta.fecha === 'string' ? meta.fecha : '');
      const moneda = r.expense_moneda_original ?? (typeof meta.moneda_original === 'string' ? meta.moneda_original : '');
      const monto =
        r.expense_monto_original ??
        (typeof meta.monto_original === 'number' || typeof meta.monto_original === 'string' ? String(meta.monto_original) : '');
      const categoria = r.expense_categoria ?? (typeof meta.categoria === 'string' ? meta.categoria : '');
      const costCenter = r.expense_cost_center ?? (typeof meta.cost_center === 'string' ? meta.cost_center : '');

      const metaValidationStatus =
        meta?.validation && typeof meta.validation === 'object' && typeof meta.validation.status === 'string'
          ? meta.validation.status
          : null;
      const validationStatus = r.expense_validation_status ?? metaValidationStatus;

      const resultado =
        r.job_status === 'success'
          ? validationStatus ?? 'PENDIENTE'
          : r.job_status === 'failed'
            ? validationStatus ?? 'ERROR'
            : r.job_status === 'skipped'
              ? 'OMITIDO'
              : 'EN_PROCESO';

      drawRow(
        {
          id,
          fecha,
          moneda,
          monto,
          categoria,
          cost_center: costCenter,
          resultado,
        },
        y,
      );

      y += rowHeight;
    }

    doc.end();
  }

  @Get('processes')
  async listProcesses(@Query('limit') limitRaw?: string): Promise<FileProcessEntity[]> {
    const limit = Math.min(Math.max(Number(limitRaw ?? 50) || 50, 1), 200);
    return this.processes.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  @Get('processes/:processId/batches')
  async getProcessBatches(
    @Param('processId', new ParseUUIDPipe({ version: '4' })) processId: string,
  ): Promise<FileProcessBatchEntity[]> {
    const entity = await this.processes.findOne({ where: { process_id: processId } });
    if (!entity) {
      throw new BadRequestException('processId no encontrado');
    }

    return this.batches.find({
      where: { process_id: processId },
      order: { batch_index: 'ASC' },
    });
  }

  @Delete('processes/:processId')
  async deleteProcess(
    @Param('processId', new ParseUUIDPipe({ version: '4' })) processId: string,
    @Query('hard') hardRaw?: string,
  ): Promise<{ deleted: boolean }> {
    const entity = await this.processes.findOne({ where: { process_id: processId } });
    if (!entity) {
      throw new BadRequestException('processId no encontrado');
    }

    const hard = (hardRaw ?? '').toLowerCase() === 'true' || hardRaw === '1';

    await this.processes.manager.transaction(async (trx) => {
      const batchesRepo = trx.getRepository(FileProcessBatchEntity);
      const processesRepo = trx.getRepository(FileProcessEntity);
      const stagesRepo = trx.getRepository(JobRunStageEntity);
      const jobsRepo = trx.getRepository(JobRunEntity);
      const expensesRepo = trx.getRepository(ExpenseEntity);

      const processBatches = await batchesRepo.find({ where: { process_id: processId } });
      const expenseIdsFromBatches = processBatches
        .flatMap((b) => b.expense_ids ?? [])
        .filter((id) => typeof id === 'string' && id.length);

      const jobs = await jobsRepo
        .createQueryBuilder('jr')
        .select(['jr.job_id'])
        .where("jr.meta ->> 'processId' = :processId", { processId })
        .getMany();

      const jobIds = jobs.map((j) => j.job_id);

      if (jobIds.length) {
        await stagesRepo.delete({ job_id: In(jobIds) });

        if (hard) {
          await expensesRepo.delete({ job_id: In(jobIds) });
        } else {
          await expensesRepo.update({ job_id: In(jobIds) }, { job_id: null });
        }

        await jobsRepo.delete({ job_id: In(jobIds) });
      }

      if (hard && expenseIdsFromBatches.length) {
        await expensesRepo.delete({ id: In(expenseIdsFromBatches) });
      }

      await batchesRepo.delete({ process_id: processId });
      await processesRepo.delete({ process_id: processId });
    });

    // Also purge Redis dedup keys so re-running the same CSV/process won't be skipped.
    // This is best-effort: process deletion in DB should not fail if Redis is down.
    await this.purgeProcessDedupKeysFromRedis(processId);

    return { deleted: true };
  }

  private async purgeProcessDedupKeysFromRedis(processId: string): Promise<void> {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    const redis = new Redis(url);

    const match = `${processId}:*`;
    const scanCount = Math.min(Math.max(Number(process.env.REDIS_SCAN_COUNT ?? 500) || 500, 10), 5000);
    const maxKeys = Math.min(Math.max(Number(process.env.REDIS_PURGE_MAX_KEYS ?? 10000) || 10000, 100), 200000);
    const delBatchSize = Math.min(Math.max(Number(process.env.REDIS_PURGE_DEL_BATCH ?? 500) || 500, 10), 5000);

    let cursor = '0';
    let totalDeleted = 0;
    let safetyTotalFound = 0;

    try {
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', scanCount);
        cursor = nextCursor;

        safetyTotalFound += keys.length;
        if (safetyTotalFound > maxKeys) {
          this.logger.warn(
            `Redis purge aborted: too many keys matched (${safetyTotalFound} > ${maxKeys}) for processId=${processId}`,
          );
          break;
        }

        for (let i = 0; i < keys.length; i += delBatchSize) {
          const batch = keys.slice(i, i + delBatchSize);
          if (!batch.length) continue;
          const deleted = await redis.del(...batch);
          totalDeleted += deleted;
        }
      } while (cursor !== '0');

      if (totalDeleted > 0) {
        this.logger.log(`Purged ${totalDeleted} redis dedup keys for processId=${processId}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to purge redis dedup keys for processId=${processId}: ${(err as Error)?.message}`);
    } finally {
      redis.disconnect();
    }
  }
}
