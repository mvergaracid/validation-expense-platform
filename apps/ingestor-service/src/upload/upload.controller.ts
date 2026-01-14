import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage/storage.service';
import { CsvSplitterService } from './splitter/csv-splitter.service';
import { FileProcessRepository } from '../persistence/file-process.repository';
import { FileProcessBatchRepository } from '../persistence/file-process-batch.repository';
import { BatchPublisher } from './publisher/batch-publisher.service';

@Controller()
export class UploadController {
  constructor(
    private readonly storage: StorageService,
    private readonly splitter: CsvSplitterService,
    private readonly processes: FileProcessRepository,
    private readonly batches: FileProcessBatchRepository,
    private readonly publisher: BatchPublisher,
  ) {}

  @Post('ingestions')
  async ingestFromStorage(
    @Body()
    body: {
      storageUri?: string;
      filename?: string;
    },
  ): Promise<{ processId: string }> {
    const storageUri = body?.storageUri;
    const filename = body?.filename;

    if (!storageUri || typeof storageUri !== 'string') {
      throw new BadRequestException('storageUri es requerido');
    }
    if (!filename || typeof filename !== 'string') {
      throw new BadRequestException('filename es requerido');
    }

    if (!filename.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('El archivo debe ser .csv');
    }

    if (!storageUri.startsWith('file://')) {
      throw new BadRequestException('storageUri inválido (solo file:// en local)');
    }

    const localPath = storageUri.replace(/^file:\/\//, '');

    const { processId } = await this.processes.createProcess({
      filename,
      storageUri,
    });

    const topic = process.env.PROCESSING_TOPIC ?? 'expense.created';
    const rawBatchSize = process.env.BATCH_SIZE;
    const batchSize = Number(rawBatchSize);
    if (!rawBatchSize || !Number.isFinite(batchSize) || batchSize <= 0) {
      throw new BadRequestException('BATCH_SIZE inválido o no configurado');
    }

    try {
      let batchIndex = 0;

      const result = await this.splitter.streamBatches({
        localPath,
        batchSize,
        onProgress: async (deltaRecords, deltaBatches) => {
          await this.processes.incrementProgress({
            processId,
            totalRecordsDelta: deltaRecords,
            publishedBatchesDelta: deltaBatches,
          });
        },
        onBatch: async (records) => {
          batchIndex += 1;
          const expenseIds = records
            .map((r) => String((r as Record<string, unknown>).gasto_id ?? (r as Record<string, unknown>).id ?? '').trim())
            .filter((v) => Boolean(v));
          await this.batches.createBatch({
            processId,
            batchIndex,
            recordCount: records.length,
            expenseIds,
          });
          await this.publisher.publishBatch({
            topic,
            batch: records,
            meta: { processId, batchIndex },
          });
        },
      });

      await this.processes.markCompleted({
        processId,
        totalRecords: result.totalRecords,
        publishedBatches: result.totalBatches,
      });

      return { processId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.processes.markError({ processId, errorMessage: msg });
      throw new InternalServerErrorException('Error procesando archivo');
    }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
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

    const { storageUri, localPath } = await this.storage.saveTemp(file);

    const { processId } = await this.processes.createProcess({
      filename: originalName,
      storageUri,
    });

    const topic = process.env.PROCESSING_TOPIC ?? 'expense.created';
    const rawBatchSize = process.env.BATCH_SIZE;
    const batchSize = Number(rawBatchSize);
    if (!rawBatchSize || !Number.isFinite(batchSize) || batchSize <= 0) {
      throw new BadRequestException('BATCH_SIZE inválido o no configurado');
    }

    try {
      let batchIndex = 0;

      const result = await this.splitter.streamBatches({
        localPath,
        fileBuffer: localPath ? undefined : file.buffer,
        batchSize,
        onProgress: async (deltaRecords, deltaBatches) => {
          await this.processes.incrementProgress({
            processId,
            totalRecordsDelta: deltaRecords,
            publishedBatchesDelta: deltaBatches,
          });
        },
        onBatch: async (records) => {
          batchIndex += 1;
          const expenseIds = records
            .map((r) => String((r as Record<string, unknown>).gasto_id ?? (r as Record<string, unknown>).id ?? '').trim())
            .filter((v) => Boolean(v));
          await this.batches.createBatch({
            processId,
            batchIndex,
            recordCount: records.length,
            expenseIds,
          });
          await this.publisher.publishBatch({
            topic,
            batch: records,
            meta: { processId, batchIndex },
          });
        },
      });

      await this.processes.markCompleted({
        processId,
        totalRecords: result.totalRecords,
        publishedBatches: result.totalBatches,
      });

      return { processId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.processes.markError({ processId, errorMessage: msg });
      throw new InternalServerErrorException('Error procesando archivo');
    }
  }
}
