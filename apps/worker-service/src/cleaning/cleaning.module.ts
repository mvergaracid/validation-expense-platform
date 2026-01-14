import { Module } from '@nestjs/common';
import { CleaningService } from './cleaning.service';
import { FingerprintService } from './fingerprint.service';
import { CacheModule } from '../cache/cache.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { WorkerHttpModule } from '../http/http.module';

@Module({
  imports: [CacheModule, PersistenceModule, WorkerHttpModule],
  providers: [CleaningService, FingerprintService],
  exports: [CleaningService],
})
export class CleaningModule {}
