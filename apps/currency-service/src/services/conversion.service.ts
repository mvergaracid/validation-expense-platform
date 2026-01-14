import { Injectable } from '@nestjs/common';
import { ConvertRequestDto, ConvertResponseDto } from '../dto/convert.dto';
import { RedisCacheService } from './redis-cache.service';
import { ExchangeRateProvider } from './exchange-rate.provider';

@Injectable()
export class ConversionService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly provider: ExchangeRateProvider,
  ) {}

  async convert(input: ConvertRequestDto): Promise<ConvertResponseDto & { monto_base?: number }> {
    const baseCurrency = (input.moneda_base ?? process.env.BASE_CURRENCY ?? 'USD').toUpperCase();
    const requestDate = input.fecha;

    const items = Array.isArray(input.montos)
      ? input.montos
      : input.monto_original !== undefined && input.moneda_original
        ? [
            {
              monto_original: input.monto_original,
              moneda_original: input.moneda_original,
              moneda_base: input.moneda_base,
            },
          ]
        : [];

    const legacySingle = items.length === 1 && !Array.isArray(input.montos);

    if (!items.length) {
      return { results: [] };
    }

    const ttlSeconds = Number(process.env.FX_CACHE_TTL_SECONDS ?? 60 * 60 * 24);

    const results = [] as ConvertResponseDto['results'];

    for (const item of items) {
      const from = item.moneda_original.toUpperCase();
      const to = (item.moneda_base ?? baseCurrency).toUpperCase();
      const date = (item as { fecha?: string }).fecha ?? requestDate;

      if (from === to) {
        results.push({
          monto_original: item.monto_original,
          moneda_original: from,
          moneda_base: to,
          monto_convertido: item.monto_original,
          tipo_cambio: 1,
        });
        continue;
      }

      const rateRes = await this.getRateWithCache({ from, to, date, ttlSeconds });
      results.push({
        monto_original: item.monto_original,
        moneda_original: from,
        moneda_base: to,
        monto_convertido: item.monto_original * rateRes.rate,
        tipo_cambio: rateRes.rate,
        rate_source: rateRes.source,
      });
    }

    return {
      results,
      ...(legacySingle
        ? { monto_base: results[0].monto_convertido, tipo_cambio: results[0].tipo_cambio }
        : {}),
    };
  }

  private async getRateWithCache(params: {
    from: string;
    to: string;
    date?: string;
    ttlSeconds: number;
  }): Promise<{ rate: number; source: 'cache' | 'api' | 'stale_cache' }> {
    const cached = await this.cache.getRate({ from: params.from, to: params.to, date: params.date });
    if (cached) {
      return { rate: cached.rate, source: 'cache' };
    }

    try {
      const fresh = await this.provider.getRate({ from: params.from, to: params.to, date: params.date });
      await this.cache.setRate({
        from: params.from,
        to: params.to,
        date: params.date,
        rate: fresh,
        ttlSeconds: params.ttlSeconds,
      });
      return { rate: fresh, source: 'api' };
    } catch (err) {
      throw err;
    } finally {
      // Refresh stale copy if possible (do not block main path)
      void this.refreshCacheInBackground(params);
    }
  }

  private async refreshCacheInBackground(params: {
    from: string;
    to: string;
    date?: string;
    ttlSeconds: number;
  }): Promise<void> {
    try {
      const fresh = await this.provider.getRate({ from: params.from, to: params.to, date: params.date });
      await this.cache.setRate({
        from: params.from,
        to: params.to,
        date: params.date,
        rate: fresh,
        ttlSeconds: params.ttlSeconds,
      });
    } catch {
      // no-op
    }
  }
}
