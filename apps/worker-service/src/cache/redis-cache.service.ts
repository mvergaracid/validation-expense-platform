import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

@Injectable()
export class RedisCacheService extends CacheService {
  private readonly redis: Redis;

  constructor() {
    super();
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(url);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds)) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
      return;
    }
    await this.redis.set(key, value);
  }

  async exists(key: string): Promise<boolean> {
    const value = await this.redis.exists(key);
    return value === 1;
  }
}
