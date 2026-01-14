import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileProcessEntity, FileProcessStatus } from './file-process.entity';

@Injectable()
export class FileProcessRepository {
  constructor(
    @InjectRepository(FileProcessEntity)
    private readonly repo: Repository<FileProcessEntity>,
  ) {}

  async createProcess(params: {
    filename: string;
    storageUri: string;
  }): Promise<{ processId: string }> {
    const entity = await this.repo.save(
      this.repo.create({
        filename: params.filename,
        storage_uri: params.storageUri,
        status: 'PROCESANDO',
        total_records: 0,
        published_batches: 0,
        error_message: null,
        finished_at: null,
      }),
    );

    return { processId: entity.process_id };
  }

  async markCompleted(params: {
    processId: string;
    totalRecords: number;
    publishedBatches: number;
  }): Promise<void> {
    await this.repo.update(
      { process_id: params.processId },
      {
        status: 'COMPLETADO',
        total_records: params.totalRecords,
        published_batches: params.publishedBatches,
        finished_at: new Date(),
      },
    );
  }

  async markError(params: {
    processId: string;
    errorMessage: string;
  }): Promise<void> {
    await this.repo.update(
      { process_id: params.processId },
      {
        status: 'ERROR',
        error_message: params.errorMessage,
        finished_at: new Date(),
      },
    );
  }

  async incrementProgress(params: {
    processId: string;
    totalRecordsDelta: number;
    publishedBatchesDelta: number;
  }): Promise<void> {
    const current = await this.repo.findOne({ where: { process_id: params.processId } });
    if (!current) {
      return;
    }

    await this.repo.update(
      { process_id: params.processId },
      {
        total_records: current.total_records + params.totalRecordsDelta,
        published_batches: current.published_batches + params.publishedBatchesDelta,
      } as unknown as any,
    );
  }
}
