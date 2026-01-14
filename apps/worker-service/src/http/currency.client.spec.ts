import { CurrencyClient } from './currency.client';

describe('CurrencyClient', () => {
  const makeDeps = (overrides?: {
    baseUrl?: string | undefined;
    defaultPolicies?: string | undefined;
    policyFromDb?: any;
    cacheGet?: (key: string) => Promise<string | null>;
    cacheSet?: (key: string, value: string, ttl?: number) => Promise<void>;
    httpPost?: (url: string, body: any) => Promise<any>;
  }) => {
    process.env.CURRENCY_SERVICE_URL = overrides?.baseUrl;
    process.env.DEFAULT_POLICIES = overrides?.defaultPolicies;
    process.env.FX_CACHE_TTL_SECONDS = '86400';

    const http = {
      post: jest.fn(async (url: string, body: any) => {
        if (overrides?.httpPost) return overrides.httpPost(url, body);
        return { monto_base: 0, tipo_cambio: 1, results: [{ rate_source: 'api' }] };
      }),
    } as any;

    const cache = {
      get: jest.fn(async (key: string) => {
        if (overrides?.cacheGet) return overrides.cacheGet(key);
        return null;
      }),
      set: jest.fn(async (key: string, value: string, ttlSeconds?: number) => {
        if (overrides?.cacheSet) return overrides.cacheSet(key, value, ttlSeconds);
      }),
    } as any;

    const policyRepo = {
      getCurrent: jest.fn(async () => overrides?.policyFromDb ?? null),
    } as any;

    const client = new CurrencyClient(http, cache, policyRepo);

    return { client, http, cache, policyRepo };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.CURRENCY_SERVICE_URL;
    delete process.env.DEFAULT_POLICIES;
    delete process.env.FX_CACHE_TTL_SECONDS;
    delete process.env.POLICIES_CACHE_TTL_MS;
  });

  it('uses policy moneda_base from DB and rounds CLP to integer', async () => {
    const { client } = makeDeps({
      baseUrl: 'http://currency:3001',
      policyFromDb: { moneda_base: 'CLP' },
      httpPost: async () => ({ monto_base: 1234.56, tipo_cambio: 9.87, results: [{ rate_source: 'api' }] }),
    });

    const res = await client.convert({ monto_original: 10.0, moneda_original: 'USD', fecha: '2025-10-11' });

    expect(res.moneda_base).toBe('CLP');
    expect(res.tipo_cambio).toBe(9.87);
    expect(res.monto_base).toBe(99);
  });

  it('uses policy moneda_base from DEFAULT_POLICIES and rounds non-CLP to 1 decimal', async () => {
    const { client } = makeDeps({
      baseUrl: 'http://currency:3001',
      policyFromDb: null,
      defaultPolicies: JSON.stringify({ moneda_base: 'USD' }),
      httpPost: async () => ({ monto_base: 0, tipo_cambio: 1.2345, results: [{ rate_source: 'api' }] }),
    });

    const res = await client.convert({ monto_original: 10.0, moneda_original: 'CLP', fecha: '2025-10-11' });

    expect(res.moneda_base).toBe('USD');
    expect(res.tipo_cambio).toBe(1.2345);
    expect(res.monto_base).toBe(12.3);
  });

  it('returns redis cached exchange rate and does not call currency-service', async () => {
    const { client, http, cache } = makeDeps({
      baseUrl: 'http://currency:3001',
      policyFromDb: { moneda_base: 'USD' },
      cacheGet: async () => '1.5',
    });

    const res = await client.convert({ monto_original: 10, moneda_original: 'CLP', fecha: '2025-10-11' });

    expect(res.rate_source).toBe('redis_cache');
    expect(res.tipo_cambio).toBe(1.5);
    expect(res.monto_base).toBe(15.0);
    expect(http.post).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledTimes(1);
  });

  it('stores exchange rate in redis when calling currency-service', async () => {
    const { client, cache, http } = makeDeps({
      baseUrl: 'http://currency:3001',
      policyFromDb: { moneda_base: 'USD' },
      cacheGet: async () => null,
      httpPost: async () => ({ monto_base: 0, tipo_cambio: 2, results: [{ rate_source: 'api' }] }),
    });

    const res = await client.convert({ monto_original: 10, moneda_original: 'CLP', fecha: '2025-10-11' });

    expect(http.post).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(res.tipo_cambio).toBe(2);
    expect(res.monto_base).toBe(20.0);
  });
});
