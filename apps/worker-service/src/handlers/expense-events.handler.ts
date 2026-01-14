import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { CleaningService } from '../cleaning/cleaning.service';

export interface ExpenseCreatedEvent {
  id: string;
  empleado_id: string;
  fecha: string;
  monto_original: number;
  moneda_original: string;
  categoria: string;
  cost_center: string;
  monto_base?: number;
  tipo_cambio?: number;
}

interface ExpenseBatchEvent {
  processId: string;
  batchIndex: number;
  records: Record<string, unknown>[];
}

const buildKeyIndex = (raw: Record<string, unknown>): Record<string, string> => {
  const idx: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    idx[key.trim().toLowerCase()] = key;
  }
  return idx;
};

const getValue = (raw: Record<string, unknown>, keyIndex: Record<string, string>, keys: string[]): unknown => {
  for (const key of keys) {
    const normalized = key.trim().toLowerCase();
    const original = keyIndex[normalized];
    if (original && raw[original] !== undefined && raw[original] !== null) {
      return raw[original];
    }
  }
  return undefined;
};

const getString = (raw: Record<string, unknown>, keyIndex: Record<string, string>, keys: string[]): string => {
  const value = getValue(raw, keyIndex, keys);
  return String(value ?? '').trim();
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const normalized = value.replace(',', '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
};

const toExpenseCreatedEvent = (raw: Record<string, unknown>): ExpenseCreatedEvent => {
  const keyIndex = buildKeyIndex(raw);

  const id = getString(raw, keyIndex, ['id', 'expense_id', 'gasto_id']);
  const empleado_id = getString(raw, keyIndex, ['empleado_id', 'employee_id', 'empleado', 'employee']);
  const fecha = getString(raw, keyIndex, ['fecha', 'date', 'fecha_gasto', 'expense_date']);
  const moneda_original = getString(raw, keyIndex, ['moneda_original', 'currency', 'moneda', 'currency_code']);
  const categoria = getString(raw, keyIndex, ['categoria', 'category']);
  const cost_center = getString(raw, keyIndex, [
    'cost_center',
    'costcenter',
    'cost_center_id',
    'centro_costo',
    'empleado_cost_center',
  ]);

  const montoOriginal = parseNumber(getValue(raw, keyIndex, ['monto_original', 'amount', 'monto', 'importe']));

  const missing: string[] = [];
  if (!id) missing.push('id');
  if (!empleado_id) missing.push('empleado_id');
  if (!fecha) missing.push('fecha');
  if (montoOriginal === undefined) missing.push('monto_original');
  if (!moneda_original) missing.push('moneda_original');
  if (!categoria) missing.push('categoria');
  if (!cost_center) missing.push('cost_center');
  if (missing.length) {
    const keys = Object.keys(raw);
    throw new Error(
      `Registro inválido: faltan campos requeridos (${missing.join(', ')}). ` +
        `Columnas recibidas: ${keys.slice(0, 30).join(', ')}${keys.length > 30 ? '...' : ''}`,
    );
  }

  const monto_original = montoOriginal as number;

  const monto_base = parseNumber(getValue(raw, keyIndex, ['monto_base', 'base_amount', 'monto_clp']));
  const tipo_cambio = parseNumber(getValue(raw, keyIndex, ['tipo_cambio', 'exchange_rate', 'tasa_cambio']));

  return {
    id,
    empleado_id,
    fecha,
    monto_original,
    moneda_original,
    categoria,
    cost_center,
    ...(monto_base !== undefined ? { monto_base } : {}),
    ...(tipo_cambio !== undefined ? { tipo_cambio } : {}),
  };
};

@Controller()
export class ExpenseEventsHandler {
  private readonly logger = new Logger(ExpenseEventsHandler.name);

  constructor(private readonly cleaningService: CleaningService) {}

  @EventPattern('expense.created')
  async onExpenseCreated(@Payload() payload: ExpenseCreatedEvent): Promise<void> {
    const jobId = randomUUID();
    this.logger.log(`Received expense.created id=${payload?.id} jobId=${jobId}`);
    await this.cleaningService.processExpense(payload, { jobId, pattern: 'expense.created' });
  }

  @EventPattern('expense.batch')
  async onExpenseBatch(@Payload() payload: ExpenseBatchEvent): Promise<void> {
    const total = Array.isArray(payload?.records) ? payload.records.length : 0;
    this.logger.log(
      `Received expense.batch processId=${payload?.processId} batchIndex=${payload?.batchIndex} size=${total}`,
    );

    if (!Array.isArray(payload?.records)) {
      return;
    }

    let recordIndex = 0;
    for (const raw of payload.records) {
      recordIndex += 1;
      try {
        const event = toExpenseCreatedEvent(raw as Record<string, unknown>);
        const jobId = randomUUID();
        await this.cleaningService.processExpense(event, {
          jobId,
          pattern: 'expense.batch',
          processId: payload.processId,
          batchIndex: payload.batchIndex,
          recordIndex,
          csvRow: raw as Record<string, unknown>,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error processing record in batch: ${msg}`);
        throw err;
      }
    }
  }
}
