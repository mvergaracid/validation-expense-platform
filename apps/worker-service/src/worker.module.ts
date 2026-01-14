import { Module } from '@nestjs/common';
import { MessagingModule } from './messaging/messaging.module';
import { ExpenseEventsHandler } from './handlers/expense-events.handler';
import { CleaningModule } from './cleaning/cleaning.module';
import { CacheModule } from './cache/cache.module';
import { PersistenceModule } from './persistence/persistence.module';
import { WorkerHttpModule } from './http/http.module';

@Module({
  imports: [
    MessagingModule,
    CleaningModule,
    CacheModule,
    PersistenceModule,
    WorkerHttpModule,
  ],
  controllers: [ExpenseEventsHandler],
})
export class WorkerModule {}
