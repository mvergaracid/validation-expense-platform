import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createTypeOrmOptions } from './persistence/orm.config';
import { FileProcessEntity } from './persistence/file-process.entity';
import { FileProcessRepository } from './persistence/file-process.repository';
import { FileProcessBatchEntity } from './persistence/file-process-batch.entity';
import { FileProcessBatchRepository } from './persistence/file-process-batch.repository';
import { UploadController } from './upload/upload.controller';
import { LocalStorageService } from './upload/storage/local-storage.service';
import { GcsStorageService } from './upload/storage/gcs-storage.service';
import { StorageService } from './upload/storage/storage.service';
import { CsvSplitterService } from './upload/splitter/csv-splitter.service';
import { BatchPublisher } from './upload/publisher/batch-publisher.service';
import { RedisBatchPublisher } from './upload/publisher/redis-batch-publisher.service';
import { GcpPubSubBatchPublisher } from './upload/publisher/gcp-pubsub-batch-publisher.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmOptions(),
    }),
    TypeOrmModule.forFeature([FileProcessEntity, FileProcessBatchEntity]),
  ],
  controllers: [UploadController],
  providers: [
    FileProcessRepository,
    FileProcessBatchRepository,
    CsvSplitterService,
    LocalStorageService,
    GcsStorageService,
    {
      provide: StorageService,
      useFactory: (local: LocalStorageService, gcs: GcsStorageService) => {
        const backend = (process.env.FILE_STORAGE_BACKEND ?? 'local').toLowerCase();
        return backend === 'gcs' ? gcs : local;
      },
      inject: [LocalStorageService, GcsStorageService],
    },
    RedisBatchPublisher,
    GcpPubSubBatchPublisher,
    {
      provide: BatchPublisher,
      useFactory: (redis: RedisBatchPublisher, gcp: GcpPubSubBatchPublisher) => {
        const transport = (process.env.WORKER_TRANSPORT ?? 'redis').toLowerCase();
        return transport === 'gcp_pubsub' ? gcp : redis;
      },
      inject: [RedisBatchPublisher, GcpPubSubBatchPublisher],
    },
  ],
})
export class IngestorModule {}
