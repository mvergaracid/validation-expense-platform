import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { ValidationStatus } from '../domain/validation-status.enum';
import { VALIDATION_RULES } from '../validation.tokens';
import { ExpenseAgeRule } from '../rules/expense-age.rule';
import { CategoryLimitRule } from '../rules/category-limit.rule';
import { CostCenterRule } from '../rules/cost-center.rule';
import { ValidationRequestDto } from '../dto/validation-request.dto';
import { Policies } from '../domain/policies.interface';
import { ValidationRule } from '../rules/validation-rule.interface';
import { getZonedNow } from '../config/timezone.config';
import {
  HISTORICAL_CASES,
  HISTORICAL_NOW,
  HISTORICAL_POLICIES,
} from '../fixtures/historical-expenses.fixture';

const TEST_TIMEZONE = 'America/Santiago';
const DEFAULT_POLICIES_ERROR =
  'No se proporcionaron politicas y DEFAULT_POLICIES no está configurado';

const basePolicies: Policies = {
  moneda_base: 'USD',
  limite_antiguedad: {
    pendiente_dias: 30,
    rechazado_dias: 60,
  },
  limites_por_categoria: {
    food: {
      aprobado_hasta: 100,
      pendiente_hasta: 150,
    },
    transport: {
      aprobado_hasta: 200,
      pendiente_hasta: 250,
    },
  },
  reglas_centro_costo: [
    {
      cost_center: 'core_engineering',
      categoria_prohibida: 'food',
    },
  ],
};

const baseExpense: ValidationRequestDto['gasto'] = {
  id: 'gasto-base',
  empleado_id: 'emp-base',
  fecha: '2025-01-01',
  monto_original: 80,
  monto_base: 80,
  moneda_original: 'USD',
  categoria: 'food',
  cost_center: 'growth',
} as const;

describe('ValidationService', () => {
  let service: ValidationService;
  let moduleRef: TestingModule;
  let defaultPoliciesBackup: string | undefined;

  const setDefaultPoliciesEnv = (policies?: Policies | null) => {
    if (!policies) {
      delete process.env.DEFAULT_POLICIES;
      return;
    }
    process.env.DEFAULT_POLICIES = JSON.stringify(policies);
  };

  beforeAll(() => {
    process.env.APP_TIMEZONE = TEST_TIMEZONE;
    defaultPoliciesBackup = process.env.DEFAULT_POLICIES;
  });

  describe('Combinación de reglas', () => {
    it('prioriza RECHAZADO cuando antigüedad > 60 y monto excede límite', async () => {
      const payload: ValidationRequestDto = {
        gasto: {
          ...baseExpense,
          fecha: '2024-09-01',
          monto_base: 200,
        },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.RECHAZADO);
      expect(
        result.alertas.some((alert) =>
          alert.includes('excede el límite máximo de 60 días'),
        ),
      ).toBe(true);
      expect(
        result.alertas.some((alert) =>
          alert.includes('excede el límite máximo (150)'),
        ),
      ).toBe(true);
    });

    it('mantiene estado pendiente cuando hay alertas de antigüedad y monto', async () => {
      const payload: ValidationRequestDto = {
        gasto: {
          ...baseExpense,
          fecha: '2024-12-05',
          monto_base: 140,
        },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.PENDIENTE);
      expect(
        result.alertas.some((alert) =>
          alert.includes('ventana de aprobación automática'),
        ),
      ).toBe(true);
      expect(
        result.alertas.some((alert) =>
          alert.includes('Requiere revisión: el monto'),
        ),
      ).toBe(true);
    });

    it('rechaza por centro de costo prohibido aunque otras reglas aprueben', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, cost_center: 'core_engineering', monto_base: 90 },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.RECHAZADO);
      expect(
        result.alertas.some((alert) =>
          alert.includes('prohibida para el centro de costo'),
        ),
      ).toBe(true);
    });
  });

  describe('Reglas de antigüedad', () => {
    it('aprueba gastos con antigüedad ≤ 30 días', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, fecha: '2025-01-05' },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.APROBADO);
    });

    it('marca como pendiente cuando 30 < días ≤ 60', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, fecha: '2024-12-05' },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.PENDIENTE);
      expect(
        result.alertas.some((alert) =>
          alert.includes('ventana de aprobación automática'),
        ),
      ).toBe(true);
    });

    it('rechaza gastos con antigüedad > 60 días', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, fecha: '2024-10-01' },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.RECHAZADO);
      expect(
        result.alertas.some((alert) => alert.includes('excede el límite máximo')),
      ).toBe(true);
    });
  });

  describe("Reglas de categoría 'food'", () => {
    it('aprueba montos ≤ 100 USD', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, monto_base: 90 },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.APROBADO);
    });

    it('marca como pendiente cuando 100 < monto ≤ 150 USD', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, monto_base: 140 },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.PENDIENTE);
      expect(
        result.alertas.some((alert) =>
          alert.includes('Requiere revisión: el monto'),
        ),
      ).toBe(true);
    });

    it('rechaza montos > 150 USD', async () => {
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense, monto_base: 175 },
        politicas: basePolicies,
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.RECHAZADO);
      expect(
        result.alertas.some((alert) => alert.includes('excede el límite máximo')),
      ).toBe(true);
    });
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ValidationService,
        ExpenseAgeRule,
        CategoryLimitRule,
        CostCenterRule,
        {
          provide: VALIDATION_RULES,
          useFactory: (
            ageRule: ExpenseAgeRule,
            categoryRule: CategoryLimitRule,
            costCenterRule: CostCenterRule,
          ) => [ageRule, categoryRule, costCenterRule],
          inject: [ExpenseAgeRule, CategoryLimitRule, CostCenterRule],
        },
      ],
    }).compile();

    service = moduleRef.get(ValidationService);
    delete process.env.DEFAULT_POLICIES;
  });

  afterAll(() => {
    if (defaultPoliciesBackup) {
      process.env.DEFAULT_POLICIES = defaultPoliciesBackup;
    } else {
      delete process.env.DEFAULT_POLICIES;
    }
  });

  it('aprueba gasto reciente dentro de límites', async () => {
    const payload: ValidationRequestDto = {
      gasto: { ...baseExpense },
      politicas: basePolicies,
    };

    const result = await service.validateExpense(
      payload,
      new Date('2025-01-10'),
    );

    expect(result.estadoFinal).toBe(ValidationStatus.APROBADO);
    expect(result.alertas).toHaveLength(0);
    expect(result.sugerencias).toHaveLength(3); // una por regla
  });

  it('marca gasto como pendiente por antigüedad', async () => {
    const payload: ValidationRequestDto = {
      gasto: { ...baseExpense, fecha: '2024-12-01' },
      politicas: basePolicies,
    };

    const result = await service.validateExpense(
      payload,
      new Date('2025-01-10'),
    );

    expect(result.estadoFinal).toBe(ValidationStatus.PENDIENTE);
    expect(result.alertas.some((alert) => alert.includes('ventana de aprobación'))).toBe(true);
  });

  it('rechaza gasto por política de centro de costo', async () => {
    const payload: ValidationRequestDto = {
      gasto: { ...baseExpense, cost_center: 'core_engineering' },
      politicas: basePolicies,
    };

    const result = await service.validateExpense(
      payload,
      new Date('2025-01-10'),
    );

    expect(result.estadoFinal).toBe(ValidationStatus.RECHAZADO);
    expect(result.alertas).toContainEqual(
      expect.stringContaining('prohibida para el centro de costo'),
    );
  });

  it('lanza error si la fecha del gasto es inválida', async () => {
    const payload: ValidationRequestDto = {
      gasto: { ...baseExpense, fecha: '2025-13-40' },
      politicas: basePolicies,
    };

    await expect(service.validateExpense(payload)).rejects.toThrow(
      'Fecha de gasto inválida',
    );
  });

  it('propaga error de regla y lo registra', async () => {
    const failingRule: ValidationRule = {
      name: 'FailingRule',
      evaluate: () => {
        throw new Error('rule failed');
      },
    };

    // Inject failing rule into the existing rules collection
    (service as any).rules = [
      ...(service as any).rules,
      failingRule,
    ];

    const loggerSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.validateExpense(
        {
          gasto: baseExpense,
          politicas: basePolicies,
        },
        getZonedNow(),
      ),
    ).rejects.toThrow();

    expect(loggerSpy).toHaveBeenCalledTimes(1);
  });

  describe('Uso de políticas por defecto', () => {
    beforeEach(() => {
      delete process.env.DEFAULT_POLICIES;
    });

    it('utiliza DEFAULT_POLICIES cuando no se envían en el payload', async () => {
      setDefaultPoliciesEnv(basePolicies);
      const payload: ValidationRequestDto = {
        gasto: { ...baseExpense },
      };

      const result = await service.validateExpense(
        payload,
        new Date('2025-01-10'),
      );

      expect(result.estadoFinal).toBe(ValidationStatus.APROBADO);
    });

    it('lanza error cuando no hay politicas explícitas ni DEFAULT_POLICIES', async () => {
      await expect(
        service.validateExpense(
          {
            gasto: { ...baseExpense },
          },
          new Date('2025-01-10'),
        ),
      ).rejects.toThrow(DEFAULT_POLICIES_ERROR);
    });

    it('lanza error si DEFAULT_POLICIES no es un JSON válido', async () => {
      process.env.DEFAULT_POLICIES = 'invalid json';

      await expect(
        service.validateExpense(
          {
            gasto: { ...baseExpense },
          },
          new Date('2025-01-10'),
        ),
      ).rejects.toThrow(
        'DEFAULT_POLICIES debe ser un JSON válido cuando se utiliza como fallback',
      );
    });
  });

  it('lanza BadRequest si moneda difiere y no hay monto_base', () => {
    expect(() =>
      service['convertAmountToBase'](
        {
          ...baseExpense,
          moneda_original: 'CLP',
          monto_base: undefined,
        } as any,
        basePolicies,
      ),
    ).toThrow(
      'monto_base es requerido cuando moneda_original difiere de moneda_base',
    );
  });

  it('usa monto_base cuando moneda difiere', () => {
    const result = service['convertAmountToBase'](
      {
        ...baseExpense,
        moneda_original: 'CLP',
        monto_base: 999,
      } as any,
      basePolicies,
    );

    expect(result).toBe(999);
  });

  it('usa monto_original cuando coincide la moneda', () => {
    const result = service['convertAmountToBase'](
      {
        ...baseExpense,
        moneda_original: basePolicies.moneda_base,
        monto_base: undefined,
        monto_original: 321,
      } as any,
      basePolicies,
    );

    expect(result).toBe(321);
  });

  describe('Casos históricos agrupados', () => {
    const groupedByStatus: Record<
      'aprobados' | 'pendientes' | 'rechazados',
      typeof HISTORICAL_CASES
    > = {
      aprobados: HISTORICAL_CASES.filter(
        (testCase) => testCase.expectedStatus === ValidationStatus.APROBADO,
      ),
      pendientes: HISTORICAL_CASES.filter(
        (testCase) => testCase.expectedStatus === ValidationStatus.PENDIENTE,
      ),
      rechazados: HISTORICAL_CASES.filter(
        (testCase) => testCase.expectedStatus === ValidationStatus.RECHAZADO,
      ),
    };

    for (const [groupName, cases] of Object.entries(groupedByStatus)) {
      describe(groupName, () => {
        cases.forEach((testCase) => {
          it(`valida el caso ${testCase.id}`, async () => {
            const payload: ValidationRequestDto = {
              gasto: { ...testCase.expense },
              politicas: HISTORICAL_POLICIES,
            };

            const result = await service.validateExpense(
              payload,
              HISTORICAL_NOW,
            );

            expect(result.estadoFinal).toBe(testCase.expectedStatus);
            if (testCase.expectedAlertIncludes?.length) {
              for (const snippet of testCase.expectedAlertIncludes) {
                expect(
                  result.alertas.some((alert) => alert.includes(snippet)),
                ).toBe(true);
              }
            } else {
              expect(result.alertas).toHaveLength(0);
            }
          });
        });
      });
    }
  });
});
