import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JobRunEntity } from '../persistence/job-run.entity';
import type { JobRunStatus } from '../persistence/job-run.entity';
import { JobRunStageEntity } from '../persistence/job-run-stage.entity';
import { ExpenseEntity } from '../persistence/expense.entity';
import { DeleteJobsDto } from './dto/delete-jobs.dto';

@Controller()
export class JobsController {
  constructor(
    @InjectRepository(JobRunEntity)
    private readonly jobRuns: Repository<JobRunEntity>,
    @InjectRepository(JobRunStageEntity)
    private readonly jobStages: Repository<JobRunStageEntity>,
    @InjectRepository(ExpenseEntity)
    private readonly expenses: Repository<ExpenseEntity>,
  ) {}

  private coerceStatus(status?: string): JobRunStatus | undefined {
    if (!status) return undefined;
    const normalized = String(status).toLowerCase();
    if (normalized === 'running' || normalized === 'success' || normalized === 'failed' || normalized === 'skipped') {
      return normalized;
    }
    throw new BadRequestException('status inválido (running|success|failed|skipped)');
  }

  @Get('jobs')
  async listJobs(
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('expenseId') expenseId?: string,
    @Query('processId') processId?: string,
    @Query('limit') legacyLimitRaw?: string,
  ): Promise<{
    data: JobRunEntity[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const requestedPage = Math.max(Number(pageRaw ?? 1) || 1, 1);
    const resolvedPageSizeInput = pageSizeRaw ?? legacyLimitRaw ?? '50';
    const pageSize = Math.min(Math.max(Number(resolvedPageSizeInput) || 50, 1), 200);
    const skip = (requestedPage - 1) * pageSize;

    const qb = this.jobRuns.createQueryBuilder('jr').orderBy('jr.created_at', 'DESC');

    const status = this.coerceStatus(statusRaw);

    if (status) {
      qb.andWhere('jr.status = :status', { status });
    }

    if (expenseId) {
      qb.andWhere('jr.expense_id = :expenseId', { expenseId });
    }

    if (processId) {
      qb.andWhere("jr.meta ->> 'processId' = :processId", { processId });
    }

    qb.skip(skip).take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const currentPage = Math.min(requestedPage, totalPages);

    return {
      data,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrevious: currentPage > 1,
      },
    };
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('jobId', new ParseUUIDPipe({ version: '4' })) jobId: string,
  ): Promise<{ run: JobRunEntity; stages: JobRunStageEntity[] }> {
    const run = await this.jobRuns.findOne({ where: { job_id: jobId } });
    if (!run) {
      throw new BadRequestException('jobId no encontrado');
    }

    const stages = await this.jobStages.find({
      where: { job_id: jobId },
      order: { created_at: 'ASC' },
    });

    return { run, stages };
  }

  @Delete('jobs')
  async deleteJobs(@Body() dto: DeleteJobsDto): Promise<{ deleted: number }> {
    const jobIds = dto.jobIds;
    if (!jobIds.length) {
      throw new BadRequestException('jobIds no puede estar vacío');
    }

    return this.jobRuns.manager.transaction(async (trx) => {
      const stagesRepo = trx.getRepository(JobRunStageEntity);
      const jobsRepo = trx.getRepository(JobRunEntity);
      const expensesRepo = trx.getRepository(ExpenseEntity);

      await stagesRepo.delete({ job_id: In(jobIds) });
      await expensesRepo.update({ job_id: In(jobIds) }, { job_id: null });
      const deleteResult = await jobsRepo.delete({ job_id: In(jobIds) });

      return { deleted: deleteResult.affected ?? 0 };
    });
  }
}
