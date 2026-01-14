import { Module } from '@nestjs/common';
import { CACHE_SERVICE, CacheService } from './cache.service';
import { RedisCacheService } from './redis-cache.service';

@Module({
  providers: [
    {
      provide: CACHE_SERVICE,
      useClass: RedisCacheService,
    },
    {
      provide: CacheService,
      useExisting: CACHE_SERVICE,
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
