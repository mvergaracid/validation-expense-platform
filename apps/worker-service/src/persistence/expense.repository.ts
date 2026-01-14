import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseEntity } from './expense.entity';
import { ExpenseCreatedEvent } from '../handlers/expense-events.handler';

interface UpsertParams {
  event: ExpenseCreatedEvent;
  jobId: string;
  fingerprint: string;
  negativeAmountDetected: boolean;
  normalizedAmount: number;
  baseAmount: number;
  exchangeRate: number | null;
  validation: { status: string; alertas: unknown[] };
}

@Injectable()
export class ExpenseRepository {
  constructor(
    @InjectRepository(ExpenseEntity)
    private readonly repo: Repository<ExpenseEntity>,
  ) {}

  async existsByFingerprint(fingerprint: string): Promise<boolean> {
    if (!fingerprint) return false;
    const existing = await this.repo.findOne({
      where: { fingerprint },
      select: ['id'],
    });
    return Boolean(existing);
  }

  async upsertFromEvent(params: UpsertParams): Promise<void> {
    const {
      event,
      jobId,
      fingerprint,
      negativeAmountDetected,
      normalizedAmount,
      baseAmount,
      exchangeRate,
      validation,
    } = params;

    const { id, empleado_id, fecha, moneda_original, categoria, cost_center } = event;

    const entity = this.repo.create({
      id,
      job_id: jobId,
      empleado_id,
      fecha,
      monto_original: normalizedAmount,
      moneda_original,
      categoria,
      cost_center,
      fingerprint,
      negative_amount_detected: negativeAmountDetected,
      monto_base: baseAmount,
      tipo_cambio: exchangeRate,
      validation_status: validation.status,
      validation_alerts: validation.alertas,
    });

    await this.repo.save(entity);
  }
}
