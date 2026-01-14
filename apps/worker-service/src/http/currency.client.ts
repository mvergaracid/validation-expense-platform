import { Injectable } from '@nestjs/common';
import { BaseHttpService } from './base-http.service';
import { CacheService } from '../cache/cache.service';
import { ValidationPolicyRepository } from '../persistence/validation-policy.repository';

type ConvertResponse = {
  monto_base: number;
  tipo_cambio: number | null;
  rate_source?: 'cache' | 'api' | 'stale_cache' | 'redis_cache';
  moneda_base?: string;
};

@Injectable()
export class CurrencyClient {
  private cachedMonedaBase: string | undefined;
  private cachedMonedaBaseAtMs = 0;

  constructor(
    private readonly http: BaseHttpService,
    private readonly cache: CacheService,
    private readonly policyRepo: ValidationPolicyRepository,
  ) {}

  private async getMonedaBase(): Promise<string | undefined> {
    const ttlMs = Number(process.env.POLICIES_CACHE_TTL_MS ?? 5000);
    const now = Date.now();
    if (this.cachedMonedaBase !== undefined && now - this.cachedMonedaBaseAtMs < ttlMs) {
      return this.cachedMonedaBase;
    }

    const fromDb = await this.policyRepo.getCurrent();
    const maybe = (fromDb as any)?.moneda_base;
    if (typeof maybe === 'string' && maybe.trim().length) {
      this.cachedMonedaBase = maybe.trim();
      this.cachedMonedaBaseAtMs = now;
      return this.cachedMonedaBase;
    }

    const policiesRaw = process.env.DEFAULT_POLICIES;
    if (policiesRaw) {
      try {
        const parsed = JSON.parse(policiesRaw) as { moneda_base?: unknown };
        if (typeof parsed?.moneda_base === 'string' && parsed.moneda_base.trim().length > 0) {
          this.cachedMonedaBase = parsed.moneda_base.trim();
          this.cachedMonedaBaseAtMs = now;
          return this.cachedMonedaBase;
        }
      } catch {
        // ignore
      }
    }

    this.cachedMonedaBase = undefined;
    this.cachedMonedaBaseAtMs = now;
    return undefined;
  }

  private normalizeBaseAmount(amount: number, monedaBase?: string): number {
    const base = (monedaBase ?? '').toUpperCase();
    if (base === 'CLP') {
      return Math.round(amount);
    }

    return Math.round(amount * 10) / 10;
  }

  private fxCacheKey(params: { fecha?: string; moneda_original: string; moneda_base: string }): string {
    const date = (params.fecha ?? 'latest').trim();
    return `fx:${params.moneda_base.toUpperCase()}:${params.moneda_original.toUpperCase()}:${date}`;
  }

  async convert(input: {
    monto_original: number;
    moneda_original: string;
    fecha?: string;
  }): Promise<ConvertResponse> {
    const baseUrl = process.env.CURRENCY_SERVICE_URL;
    const monedaBase = await this.getMonedaBase();
    const resolvedMonedaBase = (monedaBase ?? input.moneda_original).toUpperCase();
    const resolvedMonedaOriginal = (input.moneda_original ?? '').toUpperCase();

    if (!baseUrl || !resolvedMonedaOriginal.length || resolvedMonedaOriginal === resolvedMonedaBase) {
      return {
        monto_base: this.normalizeBaseAmount(input.monto_original, resolvedMonedaBase),
        tipo_cambio: 1,
        moneda_base: resolvedMonedaBase,
        rate_source: 'cache',
      };
    }

    const key = this.fxCacheKey({
      fecha: input.fecha,
      moneda_original: resolvedMonedaOriginal,
      moneda_base: resolvedMonedaBase,
    });

    const cached = await this.cache.get(key);
    if (cached !== null) {
      const rate = Number(cached);
      if (Number.isFinite(rate) && rate > 0) {
        const montoBase = this.normalizeBaseAmount(input.monto_original * rate, resolvedMonedaBase);
        return { monto_base: montoBase, tipo_cambio: rate, rate_source: 'redis_cache', moneda_base: resolvedMonedaBase };
      }
    }

    const url = `${baseUrl.replace(/\/$/, '')}/convert`;
    const res = await this.http.post<{
      monto_base: number;
      tipo_cambio?: number | null;
      results?: Array<{ rate_source?: 'cache' | 'api' | 'stale_cache' }>;
    }>(url, {
      ...input,
      moneda_base: resolvedMonedaBase,
    });

    if (typeof res?.monto_base !== 'number') {
      throw new Error('currency-service response inválida: falta monto_base');
    }

    let tipoCambio = typeof res?.tipo_cambio === 'number' ? res.tipo_cambio : null;
    const rateSource = Array.isArray(res?.results) ? res.results[0]?.rate_source : undefined;

    if (tipoCambio === null && input.monto_original !== 0) {
      const computed = res.monto_base / input.monto_original;
      tipoCambio = Number.isFinite(computed) ? computed : null;
    }

    if (tipoCambio !== null && Number.isFinite(tipoCambio) && tipoCambio > 0) {
      const ttlSeconds = Number(process.env.FX_CACHE_TTL_SECONDS ?? 86400);
      await this.cache.set(key, String(tipoCambio), ttlSeconds);
    }

    const montoBase =
      tipoCambio !== null && Number.isFinite(tipoCambio)
        ? this.normalizeBaseAmount(input.monto_original * tipoCambio, resolvedMonedaBase)
        : this.normalizeBaseAmount(res.monto_base, resolvedMonedaBase);

    return { monto_base: montoBase, tipo_cambio: tipoCambio, rate_source: rateSource, moneda_base: resolvedMonedaBase };
  }
}
