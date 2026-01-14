import { Controller, Delete, Get, Query } from '@nestjs/common';
import { RedisCacheService } from '../services/redis-cache.service';

@Controller('cache')
export class CacheController {
  constructor(private readonly cache: RedisCacheService) {}

  @Get('fx')
  async listFxCache(
    @Query('date') date?: string,
    @Query('includeStale') includeStale?: string,
    @Query('prefix') prefix?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    items: Array<
      | {
          key: string;
          prefix: 'fx';
          from: string;
          to: string;
          date: string;
          rate: number;
          fetchedAt: number;
          ttlSeconds: number;
          expiresAt: number | null;
        }
      | {
          key: string;
          prefix: 'fx_table';
          date: string;
          base: string;
          currencies: number;
          rates: Record<string, number>;
          fetchedAt: number;
          ttlSeconds: number;
          expiresAt: number | null;
        }
    >;
    nextCursor: string | null;
  }> {
    const parsedLimit = Math.min(Math.max(Number(limit ?? 200) || 200, 1), 2000);
    void includeStale;
    const p = String(prefix ?? 'all').toLowerCase();
    const normalized = p === 'fx' || p === 'fx_table' ? (p as 'fx' | 'fx_table') : 'all';
    return this.cache.listFxCache({ date, prefix: normalized, limit: parsedLimit });
  }

  @Delete('fx')
  async deleteFxCache(
    @Query('date') date?: string,
    @Query('prefix') prefix?: string,
  ): Promise<{ deleted: number }> {
    const p = String(prefix ?? 'all').toLowerCase();
    const normalized = p === 'fx' || p === 'fx_table' ? (p as 'fx' | 'fx_table') : 'all';
    const deleted = await this.cache.deleteFxCache({ date, prefix: normalized });
    return { deleted };
  }
}
