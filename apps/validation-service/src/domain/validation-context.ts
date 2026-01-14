import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { differenceInCalendarDays, isValid } from 'date-fns';
import { Expense } from './expense.interface';
import { Policies } from './policies.interface';
import {
  ValidationResult,
  ValidationSuggestion,
} from './validation-result.interface';
import { ValidationStatus } from './validation-status.enum';
import { getAppTimezone, getZonedNow } from '../config/timezone.config';

//Reflejar reglas y estados del dominio Validation

const STATUS_PRIORITY: Record<ValidationStatus, number> = {
  [ValidationStatus.APROBADO]: 0,
  [ValidationStatus.PENDIENTE]: 1,
  [ValidationStatus.RECHAZADO]: 2,
};

interface ValidationContextParams {
  expense: Expense;
  policies: Policies;
  montoConvertido: number;
  now?: Date;
}

export class ValidationContext {
  readonly expense: Expense;
  readonly policies: Policies;
  readonly alerts: string[] = [];
  readonly sugerencias: ValidationSuggestion[] = [];
  readonly monedaBase: string;
  readonly montoConvertido: number;
  readonly daysSinceExpense: number;

  private readonly now: Date;
  private currentStatus: ValidationStatus = ValidationStatus.APROBADO;

  constructor(params: ValidationContextParams) {
    this.expense = params.expense;
    this.policies = params.policies;
    this.montoConvertido = params.montoConvertido;
    this.monedaBase = params.policies.moneda_base;
    this.now = params.now ?? getZonedNow();
    this.daysSinceExpense = this.calculateDaysSinceExpense();
  }

  addAlert(alert: string): void {
    this.alerts.push(alert);
  }

  addSuggestion(rule: string, status: ValidationStatus, alert?: string): void {
    this.sugerencias.push({ regla: rule, estado: status });
    if (alert) {
      this.addAlert(alert);
    }
    this.promoteStatus(status);
  }

  getFinalStatus(): ValidationStatus {
    return this.currentStatus;
  }

  toResult(): ValidationResult {
    return {
      estadoFinal: this.getFinalStatus(),
      alertas: [...this.alerts],
      sugerencias: [...this.sugerencias],
      montoConvertido: this.montoConvertido,
      monedaBase: this.monedaBase,
    };
  }

  private promoteStatus(status: ValidationStatus): void {
    if (
      STATUS_PRIORITY[status] > STATUS_PRIORITY[this.currentStatus]
    ) {
      this.currentStatus = status;
    }
  }

  private calculateDaysSinceExpense(): number {
    const timezone = getAppTimezone();
    const expenseDate = this.toZonedDate(this.expense.fecha, timezone);
    const nowInTimezone = toZonedTime(this.now, timezone);
    const expenseInTimezone = toZonedTime(expenseDate, timezone);

    const diffDays = differenceInCalendarDays(nowInTimezone, expenseInTimezone);
    return Math.max(0, diffDays);
  }

  private toZonedDate(rawDate: string, timezone = getAppTimezone()): Date {
    const parsed = fromZonedTime(`${rawDate}T00:00:00`, timezone);
    if (!isValid(parsed)) {
      throw new Error('Fecha de gasto inválida');
    }
    return parsed;
  }
}
