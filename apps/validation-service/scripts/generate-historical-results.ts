import fs from 'node:fs';
import path from 'node:path';
import { format } from 'node:util';

import { ValidationService } from '../src/services/validation.service';
import { ExpenseAgeRule } from '../src/rules/expense-age.rule';
import { CategoryLimitRule } from '../src/rules/category-limit.rule';
import { CostCenterRule } from '../src/rules/cost-center.rule';
import { ValidationRequestDto } from '../src/dto/validation-request.dto';
import {
  HISTORICAL_CSV_PATH,
  HISTORICAL_CURRENCY_RATES,
  HISTORICAL_NOW,
  HISTORICAL_POLICIES,
} from '../src/fixtures/historical-expenses.fixture';

const service = new ValidationService([
  new ExpenseAgeRule(),
  new CategoryLimitRule(),
  new CostCenterRule(),
]);

interface CsvRow {
  raw: string[];
}

const readCsv = () => {
  const content = fs.readFileSync(HISTORICAL_CSV_PATH, 'utf-8').trim();
  const [headerLine, ...rowLines] = content.split(/\r?\n/);
  const headers = headerLine.split(',');
  const rows = rowLines.map((line) => line.split(','));
  return { headers, rows };
};

const composeResult = (status: string, alerts: string[]): string => {
  if (!alerts.length) {
    return `${status}|sin alertas`;
  }
  return `${status}|${alerts.join('||')}`;
};

const run = async () => {
  const { headers, rows } = readCsv();
  let resultColumnIndex = headers.indexOf('resultado_validacion');

  if (resultColumnIndex === -1) {
    headers.push('resultado_validacion');
    resultColumnIndex = headers.length - 1;
  }

  const headerMap: Record<string, number> = headers.reduce((acc, header, idx) => {
    acc[header] = idx;
    return acc;
  }, {} as Record<string, number>);

  const updatedRows: string[][] = [];

  for (const line of rows) {
    if (line.length === 1 && line[0].trim() === '') {
      continue;
    }

    const get = (key: string): string => line[headerMap[key]] ?? '';

    const expense: ValidationRequestDto['gasto'] = {
      id: get('gasto_id'),
      empleado_id: get('empleado_id'),
      fecha: get('fecha'),
      monto_original: Number(get('monto')),
      moneda_original: get('moneda'),
      categoria: get('categoria'),
      cost_center: get('empleado_cost_center'),
    };

    if (
      expense.moneda_original !== HISTORICAL_POLICIES.moneda_base &&
      typeof expense.monto_base !== 'number'
    ) {
      const rate = HISTORICAL_CURRENCY_RATES[expense.moneda_original];
      if (!rate) {
        throw new Error(
          format(
            'Falta tipo de cambio para %s en gasto %s',
            expense.moneda_original,
            get('gasto_id'),
          ),
        );
      }
      expense.monto_base = Number(
        (expense.monto_original * rate).toFixed(2),
      );
    }

    const payload: ValidationRequestDto = {
      gasto: expense,
      politicas: HISTORICAL_POLICIES,
    };

    const result = await service.validateExpense(payload, HISTORICAL_NOW);
    const resultString = composeResult(result.estadoFinal, result.alertas);

    const nextLine = [...line];
    nextLine[resultColumnIndex] = resultString;
    updatedRows.push(nextLine);
  }

  const output = [headers.join(','), ...updatedRows.map((row) => row.join(','))].join('\n');
  fs.writeFileSync(HISTORICAL_CSV_PATH, `${output}\n`, 'utf-8');
  console.log(`Actualizado CSV con ${updatedRows.length} filas.`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
