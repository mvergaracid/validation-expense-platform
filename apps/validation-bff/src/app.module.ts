import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createTypeOrmOptions } from './persistence/orm.config';
import { FileProcessEntity } from './persistence/file-process.entity';
import { FileProcessBatchEntity } from './persistence/file-process-batch.entity';
import { JobRunEntity } from './persistence/job-run.entity';
import { JobRunStageEntity } from './persistence/job-run-stage.entity';
import { ExpenseEntity } from './persistence/expense.entity';
import { UploadsController } from './uploads/uploads.controller';
import { UploadStorageService } from './uploads/upload-storage.service';
import { IngestorClient } from './uploads/ingestor.client';
import { JobsController } from './jobs/jobs.controller';
import { ValidationPolicyEntity } from './persistence/validation-policy.entity';
import { PoliciesController } from './policies/policies.controller';
import { CacheController } from './cache/cache.controller';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmOptions(),
    }),
    TypeOrmModule.forFeature([
      FileProcessEntity,
      FileProcessBatchEntity,
      JobRunEntity,
      JobRunStageEntity,
      ExpenseEntity,
      ValidationPolicyEntity,
    ]),
  ],
  controllers: [UploadsController, JobsController, PoliciesController, CacheController],
  providers: [UploadStorageService, IngestorClient],
})
export class AppModule {}
