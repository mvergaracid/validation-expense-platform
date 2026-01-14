import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExchangeRateProvider } from '../exchange-rate.provider';
import { RedisCacheService } from '../redis-cache.service';

@Injectable()
export class ExchangeRateApiProvider extends ExchangeRateProvider {
  constructor(
    private readonly http: HttpService,
    private readonly cache: RedisCacheService,
  ) {
    super();
  }

  private getOpenExchangeRatesAppId(): string | undefined {
    return (
      process.env.OPENEXCHANGERATES_APP_ID ??
      process.env.APP_ID ??
      process.env.EXCHANGE_RATE_API_KEY ??
      process.env.API_KEY ??
      process.env.APY_KEY
    );
  }

  private getOpenExchangeRatesBaseUrl(): string {
    return (process.env.OPENEXCHANGERATES_BASE_URL ?? 'https://openexchangerates.org/api').replace(/\/$/, '');
  }

  private normalizeDate(input?: string): string | undefined {
    if (!input) {
      return undefined;
    }
    const trimmed = String(input).trim();
    // Accept either YYYY-MM-DD or ISO timestamps; keep only the date part.
    const datePart = trimmed.includes('T') ? trimmed.split('T')[0] : trimmed;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      throw new Error('fecha inválida (formato requerido YYYY-MM-DD)');
    }
    return datePart;
  }

  private rateFromTable(params: {
    tableBase: string;
    rates: Record<string, number>;
    from: string;
    to: string;
  }): number {
    const tableBase = params.tableBase.toUpperCase();
    const from = params.from.toUpperCase();
    const to = params.to.toUpperCase();

    const baseRate = from === tableBase ? 1 : params.rates[from];
    const quoteRate = to === tableBase ? 1 : params.rates[to];

    if (typeof baseRate !== 'number' || typeof quoteRate !== 'number') {
      throw new Error(`OpenExchangeRates no soporta par ${from}_${to}`);
    }

    if (baseRate === 0) {
      throw new Error(`OpenExchangeRates rate inválido para ${from}`);
    }

    return quoteRate / baseRate;
  }

  private async getRateFromOpenExchangeRates(params: { from: string; to: string; date?: string }): Promise<number> {
    const appId = this.getOpenExchangeRatesAppId();
    if (!appId) {
      throw new Error('OPENEXCHANGERATES_APP_ID/APP_ID es requerido');
    }

    const base = params.from.toUpperCase();
    const quote = params.to.toUpperCase();

    const date = this.normalizeDate(params.date);

    const ttlSeconds = Number(process.env.FX_TABLE_TTL_SECONDS ?? process.env.FX_CACHE_TTL_SECONDS ?? 60 * 60 * 24);

    const cachedTable = await this.cache.getRatesTable({ date });
    if (cachedTable) {
      return this.rateFromTable({
        tableBase: cachedTable.base,
        rates: cachedTable.rates,
        from: base,
        to: quote,
      });
    }

    // Note: on the free plan, base is fixed to USD.
    // We'll fetch USD-based rates and compute cross-rates: base->quote = rates[quote] / rates[base]
    const path = date ? `/historical/${encodeURIComponent(date)}.json` : '/latest.json';
    const url = `${this.getOpenExchangeRatesBaseUrl()}${path}?app_id=${encodeURIComponent(appId)}`;

    const res = await firstValueFrom(
      this.http.get<{ base?: string; rates?: Record<string, number> }>(url, {
        timeout: Number(process.env.HTTP_TIMEOUT_MS ?? 3000),
        validateStatus: () => true,
      }),
    );

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`OpenExchangeRates error HTTP ${res.status}`);
    }

    const rates = res.data?.rates;
    if (!rates || typeof rates !== 'object') {
      throw new Error('OpenExchangeRates respuesta inválida: rates faltante');
    }

    const tableBase = typeof res.data?.base === 'string' && res.data.base.length ? res.data.base.toUpperCase() : 'USD';
    await this.cache.setRatesTable({ date, base: tableBase, rates, ttlSeconds });

    return this.rateFromTable({ tableBase, rates, from: base, to: quote });
  }

  async getRate(params: { from: string; to: string; date?: string }): Promise<number> {
    // Prefer OpenExchangeRates when app id is configured
    if (this.getOpenExchangeRatesAppId()) {
      return this.getRateFromOpenExchangeRates(params);
    }

    const providerUrl = process.env.EXCHANGE_RATE_API_URL;
    if (!providerUrl) {
      throw new Error('EXCHANGE_RATE_API_URL es requerido');
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      throw new Error('EXCHANGE_RATE_API_KEY es requerido');
    }

    const base = params.from.toUpperCase();
    const quote = params.to.toUpperCase();

    const url = `${providerUrl.replace(/\/$/, '')}/v6/${apiKey}/pair/${base}/${quote}`;
    const res = await firstValueFrom(
      this.http.get<{ conversion_rate?: number }>(url, {
        timeout: Number(process.env.HTTP_TIMEOUT_MS ?? 3000),
        validateStatus: () => true,
      }),
    );

    if (res.status >= 200 && res.status < 300 && typeof res.data?.conversion_rate === 'number') {
      return res.data.conversion_rate;
    }

    throw new Error(`ExchangeRateApiProvider error HTTP ${res.status}`);
  }
}
