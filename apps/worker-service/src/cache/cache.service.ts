export abstract class CacheService {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  abstract exists(key: string): Promise<boolean>;
}

export const CACHE_SERVICE = Symbol('CACHE_SERVICE');
