import fs from 'node:fs';
import path from 'node:path';
import { Expense } from '../domain/expense.interface';
import { Policies } from '../domain/policies.interface';
import { ValidationStatus } from '../domain/validation-status.enum';
import { ValidationContext } from '../domain/validation-context';
import { ValidationRule } from '../rules/validation-rule.interface';
import { ExpenseAgeRule } from '../rules/expense-age.rule';
import { CategoryLimitRule } from '../rules/category-limit.rule';
import { CostCenterRule } from '../rules/cost-center.rule';

export const HISTORICAL_POLICIES: Policies = {
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

export const HISTORICAL_NOW = new Date('2025-10-21T00:00:00Z');

export const HISTORICAL_CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  CLP: 0.0012,
  MXN: 0.058,
  EUR: 1.1,
};

export const HISTORICAL_CSV_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'gastos_historicos (2).csv',
);

export interface CsvValidationCase {
  id: string;
  expense: Expense;
  expectedStatus: ValidationStatus;
  expectedAlerts: string[];
}

const parseResultado = (
  raw?: string,
): { status: ValidationStatus; alerts: string[] } => {
  if (!raw) {
    throw new Error(
      'La columna resultado_validacion es requerida para los casos históricos',
    );
  }

  const [statusPart, alertsPart = ''] = raw.split('|');
  const status = statusPart.trim() as ValidationStatus;
  const alerts =
    alertsPart.trim() === '' || alertsPart.trim() === 'sin alertas'
      ? []
      : alertsPart.split('||').map((item) => item.trim());

  return { status, alerts };
};

const HISTORICAL_RULES: ValidationRule[] = [
  new ExpenseAgeRule(),
  new CategoryLimitRule(),
  new CostCenterRule(),
];

const evaluateHistoricalExpense = (
  expense: Expense,
): { status: ValidationStatus; alerts: string[] } => {
  const montoConvertido =
    typeof expense.monto_base === 'number'
      ? expense.monto_base
      : expense.monto_original;
  const context = new ValidationContext({
    expense,
    policies: HISTORICAL_POLICIES,
    montoConvertido,
    now: HISTORICAL_NOW,
  });

  for (const rule of HISTORICAL_RULES) {
    rule.evaluate(context);
  }

  const { estadoFinal, alertas } = context.toResult();
  return { status: estadoFinal, alerts: alertas };
};

export const parseHistoricalCsvCases = (): CsvValidationCase[] => {
  const fileContents = fs.readFileSync(HISTORICAL_CSV_PATH, 'utf-8').trim();
  const [headerLine, ...rows] = fileContents.split(/\r?\n/);
  const headers = headerLine.split(',');
  const resultIndex = headers.indexOf('resultado_validacion');

  const headerMap = headers.reduce<Record<string, number>>((acc, header, idx) => {
    acc[header] = idx;
    return acc;
  }, {});

  const hasResultColumn = resultIndex !== -1;

  return rows
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const cols = row.split(',');

      const get = (key: string): string => {
        const idx = headerMap[key];
        return typeof idx === 'number' ? cols[idx] ?? '' : '';
      };

      const currency = get('moneda');
      const expense: Expense = {
        id: get('gasto_id'),
        empleado_id: get('empleado_id'),
        fecha: get('fecha'),
        monto_original: Number(get('monto')),
        moneda_original: currency,
        categoria: get('categoria'),
        cost_center: get('empleado_cost_center'),
      };

      if (
        currency !== HISTORICAL_POLICIES.moneda_base &&
        typeof expense.monto_base !== 'number'
      ) {
        const rate = HISTORICAL_CURRENCY_RATES[currency];
        if (!rate) {
          throw new Error(
            `No existe tipo de cambio para ${currency} en el caso ${get('gasto_id')}`,
          );
        }
        expense.monto_base = Number(
          (expense.monto_original * rate).toFixed(2),
        );
      }

      const { status, alerts } = hasResultColumn
        ? parseResultado(get('resultado_validacion'))
        : evaluateHistoricalExpense(expense);

      return {
        id: get('gasto_id'),
        expense,
        expectedStatus: status,
        expectedAlerts: alerts,
      };
    });
};

export type HistoricalValidationCase = CsvValidationCase & {
  expectedAlertIncludes?: string[];
};

export const HISTORICAL_CASES: HistoricalValidationCase[] =
  parseHistoricalCsvCases().map((testCase) => ({
    ...testCase,
    expectedAlertIncludes: testCase.expectedAlerts.length
      ? testCase.expectedAlerts
      : undefined,
  }));
