import { BadRequestException, Controller, Delete, Get, Query } from '@nestjs/common';
import axios from 'axios';

@Controller('cache')
export class CacheController {
  private currencyServiceUrl(): string {
    const baseUrl = process.env.CURRENCY_SERVICE_URL;
    if (!baseUrl) {
      throw new BadRequestException('CURRENCY_SERVICE_URL es requerido');
    }
    return baseUrl.replace(/\/$/, '');
  }

  @Get('fx')
  async listFxCache(
    @Query('date') date?: string,
    @Query('includeStale') includeStale?: string,
    @Query('prefix') prefix?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    items: Array<{
      key: string;
      prefix: 'fx' | 'fx_table';
      from?: string;
      to?: string;
      date: string;
      rate?: number;
      base?: string;
      currencies?: number;
      rates?: Record<string, number>;
      fetchedAt: number;
      ttlSeconds: number;
      expiresAt: number | null;
    }>;
    nextCursor: string | null;
  }> {
    const baseUrl = this.currencyServiceUrl();
    const url = `${baseUrl}/cache/fx`;

    const res = await axios.get(url, {
      params: {
        ...(date ? { date } : {}),
        ...(includeStale !== undefined ? { includeStale } : {}),
        ...(prefix !== undefined ? { prefix } : {}),
        ...(limit !== undefined ? { limit } : {}),
      },
    });

    if (!res?.data || !Array.isArray(res.data.items)) {
      throw new BadRequestException('currency-service response inválida (cache/fx)');
    }

    return res.data;
  }

  @Delete('fx')
  async deleteFxCache(
    @Query('date') date?: string,
    @Query('prefix') prefix?: string,
  ): Promise<{ deleted: number }> {
    const baseUrl = this.currencyServiceUrl();
    const url = `${baseUrl}/cache/fx`;

    const res = await axios.delete(url, {
      params: {
        ...(date ? { date } : {}),
        ...(prefix ? { prefix } : {}),
      },
    });

    if (!res?.data || typeof res.data.deleted !== 'number') {
      throw new BadRequestException('currency-service response inválida (cache/fx delete)');
    }

    return res.data;
  }
}
