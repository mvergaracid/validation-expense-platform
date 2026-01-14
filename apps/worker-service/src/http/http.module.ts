import { Module } from '@nestjs/common';
import { HttpModule as NestHttpModule } from '@nestjs/axios';
import { BaseHttpService } from './base-http.service';
import { CurrencyClient } from './currency.client';
import { ValidationClient } from './validation.client';
import { PersistenceModule } from '../persistence/persistence.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [NestHttpModule, PersistenceModule, CacheModule],
  providers: [BaseHttpService, CurrencyClient, ValidationClient],
  exports: [CurrencyClient, ValidationClient],
})
export class WorkerHttpModule {}
