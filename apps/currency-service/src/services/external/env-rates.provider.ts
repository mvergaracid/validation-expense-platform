import { Injectable } from '@nestjs/common';
import { ExchangeRateProvider } from '../exchange-rate.provider';

@Injectable()
export class EnvRatesProvider extends ExchangeRateProvider {
  async getRate(params: { from: string; to: string; date?: string }): Promise<number> {
    const raw = process.env.DEFAULT_RATES;
    if (!raw) {
      throw new Error('DEFAULT_RATES es requerido cuando EXCHANGE_RATE_PROVIDER=env');
    }

    let parsed: Record<string, number>;
    try {
      parsed = JSON.parse(raw) as Record<string, number>;
    } catch {
      throw new Error('DEFAULT_RATES inválido (debe ser JSON)');
    }

    const key = `${params.from.toUpperCase()}_${params.to.toUpperCase()}`;
    const rate = parsed[key];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`No existe tasa para ${key} en DEFAULT_RATES`);
    }

    return rate;
  }
}
