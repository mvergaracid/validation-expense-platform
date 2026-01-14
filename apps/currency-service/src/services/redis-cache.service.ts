import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

interface CacheEntry {
  rate: number;
  fetchedAt: number;
}

interface RatesTableEntry {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

type FxCacheItem = {
  key: string;
  prefix: 'fx';
  from: string;
  to: string;
  date: string;
  rate: number;
  fetchedAt: number;
  ttlSeconds: number;
  expiresAt: number | null;
};

type FxTableCacheItem = {
  key: string;
  prefix: 'fx_table';
  date: string;
  base: string;
  currencies: number;
  rates: Record<string, number>;
  fetchedAt: number;
  ttlSeconds: number;
  expiresAt: number | null;
};

@Injectable()
export class RedisCacheService {
  private readonly redis: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(url);
  }

  buildKey(params: { from: string; to: string; date?: string }): string {
    const date = params.date ? String(params.date) : 'latest';
    return `fx:${params.from.toUpperCase()}:${params.to.toUpperCase()}:${date}`;
  }

  buildRatesTableKey(params: { date?: string }): string {
    const date = params.date ? String(params.date) : 'latest';
    return `fx_table:${date}`;
  }

  async getRatesTable(params: { date?: string }): Promise<RatesTableEntry | null> {
    const key = this.buildRatesTableKey(params);
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as RatesTableEntry;
      if (
        typeof parsed?.base !== 'string' ||
        !parsed.base.length ||
        !parsed.rates ||
        typeof parsed.rates !== 'object' ||
        typeof parsed?.fetchedAt !== 'number'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async setRatesTable(params: { date?: string; base: string; rates: Record<string, number>; ttlSeconds: number }): Promise<void> {
    const key = this.buildRatesTableKey({ date: params.date });
    const entry: RatesTableEntry = { base: params.base, rates: params.rates, fetchedAt: Date.now() };
    await this.redis.set(key, JSON.stringify(entry), 'EX', params.ttlSeconds);
  }

  async getRate(params: { from: string; to: string; date?: string }): Promise<CacheEntry | null> {
    const key = this.buildKey(params);
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as CacheEntry;
      if (typeof parsed?.rate !== 'number' || typeof parsed?.fetchedAt !== 'number') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async setRate(params: {
    from: string;
    to: string;
    date?: string;
    rate: number;
    ttlSeconds: number;
  }): Promise<void> {
    const key = this.buildKey(params);
    const entry: CacheEntry = { rate: params.rate, fetchedAt: Date.now() };
    await this.redis.set(key, JSON.stringify(entry), 'EX', params.ttlSeconds);
  }

  private parseFxKey(key: string): { prefix: 'fx'; from: string; to: string; date: string } | null {
    const parts = key.split(':');
    if (parts.length !== 4) return null;
    const [prefix, from, to, date] = parts;
    if (prefix !== 'fx') return null;
    if (!from || !to || !date) return null;
    return { prefix: 'fx', from, to, date };
  }

  private parseFxTableKey(key: string): { prefix: 'fx_table'; date: string } | null {
    const parts = key.split(':');
    if (parts.length !== 2) return null;
    const [prefix, date] = parts;
    if (prefix !== 'fx_table') return null;
    if (!date) return null;
    return { prefix: 'fx_table', date };
  }

  async listFxCache(params: {
    date?: string;
    prefix?: 'fx' | 'fx_table' | 'all';
    limit: number;
  }): Promise<{ items: Array<FxCacheItem | FxTableCacheItem>; nextCursor: string | null }> {
    const items: Array<FxCacheItem | FxTableCacheItem> = [];
    const targetDate = params.date ? String(params.date).trim() : undefined;
    const patterns: string[] = [];
    const prefix = params.prefix ?? 'all';
    if (prefix === 'all' || prefix === 'fx') patterns.push('fx:*');
    if (prefix === 'all' || prefix === 'fx_table') patterns.push('fx_table:*');

    let cursor = '0';
    let patternIndex = 0;

    while (items.length < params.limit) {
      const match = patterns[patternIndex];
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', match, 'COUNT', '200');
      cursor = nextCursor;

      for (const key of keys) {
        const fxParsed = this.parseFxKey(key);
        const tableParsed = fxParsed ? null : this.parseFxTableKey(key);
        if (!fxParsed && !tableParsed) continue;

        const date = fxParsed?.date ?? tableParsed?.date;
        if (targetDate && date !== targetDate) continue;

        const [raw, ttlSeconds] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
        if (!raw) continue;

        const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;

        if (fxParsed) {
          let entry: CacheEntry | null = null;
          try {
            const maybe = JSON.parse(raw) as CacheEntry;
            if (typeof maybe?.rate === 'number' && typeof maybe?.fetchedAt === 'number') {
              entry = maybe;
            }
          } catch {
            entry = null;
          }
          if (!entry) continue;

          items.push({
            key,
            prefix: fxParsed.prefix,
            from: fxParsed.from,
            to: fxParsed.to,
            date: fxParsed.date,
            rate: entry.rate,
            fetchedAt: entry.fetchedAt,
            ttlSeconds,
            expiresAt,
          });
        } else if (tableParsed) {
          let entry: RatesTableEntry | null = null;
          try {
            const maybe = JSON.parse(raw) as RatesTableEntry;
            if (
              typeof maybe?.base === 'string' &&
              maybe.base.length &&
              maybe.rates &&
              typeof maybe.rates === 'object' &&
              typeof maybe?.fetchedAt === 'number'
            ) {
              entry = maybe;
            }
          } catch {
            entry = null;
          }
          if (!entry) continue;

          items.push({
            key,
            prefix: tableParsed.prefix,
            date: tableParsed.date,
            base: entry.base,
            currencies: Object.keys(entry.rates).length,
            rates: entry.rates,
            fetchedAt: entry.fetchedAt,
            ttlSeconds,
            expiresAt,
          });
        }

        if (items.length >= params.limit) break;
      }

      if (cursor === '0') {
        if (patternIndex + 1 < patterns.length) {
          patternIndex += 1;
          cursor = '0';
          continue;
        }
        break;
      }
    }

    const nextCursor = cursor !== '0' ? cursor : null;
    return { items, nextCursor };
  }

  async deleteFxCache(params: {
    date?: string;
    prefix: 'fx' | 'fx_table' | 'all';
  }): Promise<number> {
    const targetDate = params.date ? String(params.date).trim() : undefined;
    const patterns: string[] = [];
    if (params.prefix === 'all' || params.prefix === 'fx') patterns.push('fx:*');
    if (params.prefix === 'all' || params.prefix === 'fx_table') patterns.push('fx_table:*');
    // Backward-compatible cleanup: allow purging historical stale keys when prefix=all
    if (params.prefix === 'all') patterns.push('fx_stale:*');

    let deleted = 0;
    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '500');
        cursor = nextCursor;

        const toDelete = targetDate
          ? keys.filter((k) => {
              const parsed = this.parseFxKey(k);
              if (parsed?.date === targetDate) return true;
              const parsedTable = this.parseFxTableKey(k);
              return parsedTable?.date === targetDate;
            })
          : keys;

        if (toDelete.length) {
          deleted += await this.redis.del(...toDelete);
        }
      } while (cursor !== '0');
    }

    return deleted;
  }
}
