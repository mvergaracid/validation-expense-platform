import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileProcessBatchEntity } from './file-process-batch.entity';

@Injectable()
export class FileProcessBatchRepository {
  constructor(
    @InjectRepository(FileProcessBatchEntity)
    private readonly repo: Repository<FileProcessBatchEntity>,
  ) {}

  async createBatch(params: {
    processId: string;
    batchIndex: number;
    recordCount: number;
    expenseIds: string[];
  }): Promise<void> {
    await this.repo.save(
      this.repo.create({
        process_id: params.processId,
        batch_index: params.batchIndex,
        record_count: params.recordCount,
        expense_ids: params.expenseIds,
      }),
    );
  }
}
