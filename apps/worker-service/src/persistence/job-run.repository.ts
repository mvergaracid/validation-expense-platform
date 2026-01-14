import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobRunEntity, JobRunStatus } from './job-run.entity';
import { JobRunStageEntity, JobStageStatus } from './job-run-stage.entity';

@Injectable()
export class JobRunRepository {
  constructor(
    @InjectRepository(JobRunEntity)
    private readonly runs: Repository<JobRunEntity>,
    @InjectRepository(JobRunStageEntity)
    private readonly stages: Repository<JobRunStageEntity>,
  ) {}

  async createRun(params: {
    jobId: string;
    pattern: string;
    expenseId?: string;
    fingerprint?: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    await this.runs.save({
      job_id: params.jobId,
      pattern: params.pattern,
      expense_id: params.expenseId ?? null,
      fingerprint: params.fingerprint ?? null,
      status: 'running',
      finished_at: null,
      meta: params.meta ?? null,
    });
  }

  async finishRun(jobId: string, status: JobRunStatus): Promise<void> {
    await this.runs.update(
      { job_id: jobId },
      {
        status,
        finished_at: new Date(),
      },
    );
  }

  async startStage(jobId: string, stage: string, data?: Record<string, unknown>): Promise<string> {
    const entity = await this.stages.save({
      job_id: jobId,
      stage,
      status: 'running',
      finished_at: null,
      data: data ?? null,
      error: null,
    });

    return entity.id;
  }

  async finishStage(params: {
    stageId: string;
    status: JobStageStatus;
    data?: Record<string, unknown>;
    error?: string;
  }): Promise<void> {
    await this.stages.update(
      { id: params.stageId },
      ({
        status: params.status,
        finished_at: new Date(),
        data: params.data ?? null,
        error: params.error ?? null,
      } as unknown) as any,
    );
  }

  async mergeMeta(jobId: string, metaPatch: Record<string, unknown>): Promise<void> {
    const run = await this.runs.findOne({ where: { job_id: jobId } });
    if (!run) return;
    run.meta = { ...(run.meta ?? {}), ...metaPatch };
    await this.runs.save(run);
  }
}
