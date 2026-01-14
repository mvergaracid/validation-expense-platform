import { CleaningService } from './cleaning.service';

describe('CleaningService - base amount normalization', () => {
  const makeService = (overrides?: { monedaBase?: string }) => {
    const cache = {
      exists: jest.fn(async () => false),
      set: jest.fn(async () => undefined),
    } as any;

    const fingerprint = {
      build: jest.fn(() => 'fp'),
    } as any;

    const repo = {
      existsByFingerprint: jest.fn(async () => false),
      upsertFromEvent: jest.fn(async () => undefined),
    } as any;

    let stageN = 0;
    const jobRuns = {
      createRun: jest.fn(async () => undefined),
      startStage: jest.fn(async () => `stage-${++stageN}`),
      finishStage: jest.fn(async () => undefined),
      mergeMeta: jest.fn(async () => undefined),
      finishRun: jest.fn(async () => undefined),
    } as any;

    const validationClient = {
      validate: jest.fn(async () => ({ status: 'success', alertas: [] })),
    } as any;

    const currencyClient = {
      convert: jest.fn(async (input: any) => ({
        monto_base: 0,
        tipo_cambio: 1,
        moneda_base: overrides?.monedaBase ?? 'CLP',
      })),
    } as any;

    const svc = new CleaningService(cache, fingerprint, repo, jobRuns, validationClient, currencyClient);

    return { svc, repo, currencyClient, validationClient, jobRuns };
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rounds provided monto_base to integer when moneda_base is CLP', async () => {
    const { svc, repo } = makeService({ monedaBase: 'CLP' });

    await svc.processExpense(
      {
        id: 'g1',
        empleado_id: 'e1',
        fecha: '2025-10-11',
        monto_original: 10,
        moneda_original: 'USD',
        categoria: 'food',
        cost_center: 'cc',
        monto_base: 1234.56,
      } as any,
      { jobId: 'job-1', pattern: 'expense.batch' },
    );

    expect(repo.upsertFromEvent).toHaveBeenCalledTimes(1);
    const call = (repo.upsertFromEvent as jest.Mock).mock.calls[0][0];
    expect(call.baseAmount).toBe(1235);
  });

  it('rounds provided monto_base to 1 decimal when moneda_base is not CLP', async () => {
    const { svc, repo } = makeService({ monedaBase: 'USD' });

    await svc.processExpense(
      {
        id: 'g1',
        empleado_id: 'e1',
        fecha: '2025-10-11',
        monto_original: 10,
        moneda_original: 'CLP',
        categoria: 'food',
        cost_center: 'cc',
        monto_base: 12.34,
      } as any,
      { jobId: 'job-1', pattern: 'expense.batch' },
    );

    expect(repo.upsertFromEvent).toHaveBeenCalledTimes(1);
    const call = (repo.upsertFromEvent as jest.Mock).mock.calls[0][0];
    expect(call.baseAmount).toBe(12.3);
  });

  it('skips processing when monto_original is negative (no currency/validation/persist)', async () => {
    const { svc, repo, currencyClient, validationClient, jobRuns } = makeService({ monedaBase: 'CLP' });

    await svc.processExpense(
      {
        id: 'g-neg',
        empleado_id: 'e1',
        fecha: '2025-10-11',
        monto_original: -10,
        moneda_original: 'USD',
        categoria: 'food',
        cost_center: 'cc',
      } as any,
      { jobId: 'job-neg', pattern: 'expense.batch' },
    );

    expect(currencyClient.convert).not.toHaveBeenCalled();
    expect(validationClient.validate).not.toHaveBeenCalled();
    expect(repo.upsertFromEvent).not.toHaveBeenCalled();

    expect(jobRuns.finishRun).toHaveBeenCalledWith('job-neg', 'skipped');

    const finishStageCalls = (jobRuns.finishStage as jest.Mock).mock.calls;
    const normalizeCall = finishStageCalls.find((c) => c[0]?.stageId?.startsWith('stage-'));
    expect(normalizeCall?.[0]?.status).toBe('skipped');
    expect(normalizeCall?.[0]?.data?.reason).toBe('negative_amount');
  });

  it('skips processing when fingerprint exists in DB even if redis cache missed', async () => {
    const { svc, repo, currencyClient, validationClient, jobRuns } = makeService({ monedaBase: 'CLP' });
    (repo.existsByFingerprint as jest.Mock).mockResolvedValueOnce(true);

    await svc.processExpense(
      {
        id: 'g-dup',
        empleado_id: 'e1',
        fecha: '2025-10-11',
        monto_original: 10,
        moneda_original: 'USD',
        categoria: 'food',
        cost_center: 'cc',
      } as any,
      { jobId: 'job-dup', pattern: 'expense.batch', processId: 'p1' },
    );

    expect(currencyClient.convert).not.toHaveBeenCalled();
    expect(validationClient.validate).not.toHaveBeenCalled();
    expect(repo.upsertFromEvent).not.toHaveBeenCalled();

    expect(jobRuns.finishRun).toHaveBeenCalledWith('job-dup', 'skipped');
  });
});
