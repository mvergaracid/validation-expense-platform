import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheController } from './controllers/cache.controller';
import { ConvertController } from './controllers/convert.controller';
import { RedisCacheService } from './services/redis-cache.service';
import { ConversionService } from './services/conversion.service';
import { ExchangeRateProvider } from './services/exchange-rate.provider';
import { ExchangeRateApiProvider } from './services/external/exchange-rate-api.provider';
import { EnvRatesProvider } from './services/external/env-rates.provider';

@Module({
  imports: [HttpModule],
  controllers: [ConvertController, CacheController],
  providers: [
    RedisCacheService,
    ConversionService,
    {
      provide: ExchangeRateProvider,
      useFactory: (api: ExchangeRateApiProvider, env: EnvRatesProvider) => {
        const provider = (process.env.EXCHANGE_RATE_PROVIDER ?? 'exchangerate_api').toLowerCase();
        return provider === 'env' ? env : api;
      },
      inject: [ExchangeRateApiProvider, EnvRatesProvider],
    },
    ExchangeRateApiProvider,
    EnvRatesProvider,
  ],
})
export class CurrencyModule {}
