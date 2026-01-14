import { Injectable, Logger } from '@nestjs/common';
import { ExpenseCreatedEvent } from '../handlers/expense-events.handler';
import { CacheService } from '../cache/cache.service';
import { FingerprintService } from './fingerprint.service';
import { ExpenseRepository } from '../persistence/expense.repository';
import { ValidationClient } from '../http/validation.client';
import { CurrencyClient } from '../http/currency.client';
import { JobRunRepository } from '../persistence/job-run.repository';

interface JobContext {
  jobId: string;
  pattern: string;
  processId?: string;
  batchIndex?: number;
  recordIndex?: number;
  csvRow?: Record<string, unknown>;
}

@Injectable()
export class CleaningService {
  private readonly logger = new Logger(CleaningService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly fingerprint: FingerprintService,
    private readonly repo: ExpenseRepository,
    private readonly jobRuns: JobRunRepository,
    private readonly validationClient: ValidationClient,
    private readonly currencyClient: CurrencyClient,
  ) {}

  async processExpense(event: ExpenseCreatedEvent, ctx: JobContext): Promise<void> {
    await this.jobRuns.createRun({
      jobId: ctx.jobId,
      pattern: ctx.pattern,
      expenseId: event.id,
      meta: {
        id: event.id,
        empleado_id: event.empleado_id,
        fecha: event.fecha,
        monto_original: event.monto_original,
        moneda_original: event.moneda_original,
        categoria: event.categoria,
        cost_center: event.cost_center,
        ...(typeof event.monto_base === 'number' ? { monto_base: event.monto_base } : {}),
        ...(typeof event.tipo_cambio === 'number' ? { tipo_cambio: event.tipo_cambio } : {}),
        ...(ctx.processId ? { processId: ctx.processId } : {}),
        ...(typeof ctx.batchIndex === 'number' ? { batchIndex: ctx.batchIndex } : {}),
        ...(typeof ctx.recordIndex === 'number' ? { recordIndex: ctx.recordIndex } : {}),
        ...(ctx.csvRow ? { csv_row: ctx.csvRow } : {}),
      },
    });

    const fingerprint = this.fingerprint.build(event);
    const ttlSeconds = Number(process.env.DEDUP_TTL_SECONDS ?? 86400);

    const dedupKey = ctx.processId ? `${ctx.processId}:${fingerprint}` : fingerprint;

    const dedupStageId = await this.jobRuns.startStage(ctx.jobId, 'dedup', { ttlSeconds });

    const alreadySeen = await this.cache.exists(dedupKey);
    if (alreadySeen) {
      this.logger.warn(`Duplicate event fingerprint=${fingerprint} (skipping)`);
      await this.jobRuns.finishStage({
        stageId: dedupStageId,
        status: 'skipped',
        data: { fingerprint },
      });

      await this.jobRuns.mergeMeta(ctx.jobId, {
        dedup: {
          skipped: true,
          reason: 'duplicate_fingerprint',
          fingerprint,
        },
      });

      await this.jobRuns.finishRun(ctx.jobId, 'skipped');
      return;
    }

    const alreadyPersisted = await this.repo.existsByFingerprint(fingerprint);
    if (alreadyPersisted) {
      this.logger.warn(`Duplicate event fingerprint=${fingerprint} (found in DB, keeping for audit)`);
      await this.jobRuns.finishStage({
        stageId: dedupStageId,
        status: 'skipped',
        data: { fingerprint, source: 'db', duplicate: true },
      });

      await this.jobRuns.mergeMeta(ctx.jobId, {
        dedup: {
          skipped: true,
          reason: 'duplicate_fingerprint_db',
          fingerprint,
        },
      });

      await this.jobRuns.finishRun(ctx.jobId, 'skipped');
      return;
    } else {
      await this.cache.set(dedupKey, '1', ttlSeconds);

      await this.jobRuns.finishStage({
        stageId: dedupStageId,
        status: 'success',
        data: { fingerprint },
      });
    }

    try {
      const normalizeStageId = await this.jobRuns.startStage(ctx.jobId, 'normalize');

      const negativeAmountDetected = event.monto_original < 0;
      const normalizedAmount = negativeAmountDetected
        ? Math.abs(event.monto_original)
        : event.monto_original;

      await this.jobRuns.finishStage({
        stageId: normalizeStageId,
        status: negativeAmountDetected ? 'skipped' : 'success',
        data: {
          negativeAmountDetected,
          normalizedAmount,
          ...(negativeAmountDetected ? { reason: 'negative_amount' } : {}),
        },
      });

      if (negativeAmountDetected) {
        await this.jobRuns.mergeMeta(ctx.jobId, {
          negative_amount: {
            skipped: true,
            reason: 'negative_amount',
            monto_original: event.monto_original,
          },
        });

        await this.jobRuns.finishRun(ctx.jobId, 'skipped');
        return;
      }

      const currencyStageId = await this.jobRuns.startStage(ctx.jobId, 'currency', {
        moneda_original: event.moneda_original,
      });

      let baseAmount: number;
      let exchangeRate: number | null = null;

      if (typeof event.tipo_cambio === 'number') {
        exchangeRate = event.tipo_cambio;
      }

      if (typeof event.monto_base === 'number') {
        const normalizedBase = await this.currencyClient.convert({
          monto_original: 0,
          moneda_original: event.moneda_original,
          fecha: event.fecha,
        });
        baseAmount = (normalizedBase?.moneda_base ?? '').toUpperCase() === 'CLP'
          ? Math.round(event.monto_base)
          : Math.round(event.monto_base * 10) / 10;
        if (exchangeRate === null && normalizedAmount !== 0) {
          const computed = baseAmount / normalizedAmount;
          exchangeRate = Number.isFinite(computed) ? computed : null;
        }
      } else {
        const conversion = await this.currencyClient.convert({
          monto_original: normalizedAmount,
          moneda_original: event.moneda_original,
          fecha: event.fecha,
        });
        baseAmount = conversion.monto_base;
        exchangeRate = exchangeRate ?? conversion.tipo_cambio;

        await this.jobRuns.finishStage({
          stageId: currencyStageId,
          status: 'success',
          data: {
            baseAmount,
            tipo_cambio: exchangeRate,
            ...(conversion.rate_source ? { rate_source: conversion.rate_source } : {}),
          },
        });

        const validationStageId = await this.jobRuns.startStage(ctx.jobId, 'validation');

        const validation = await this.validationClient.validate({
          gasto: {
            id: event.id,
            empleado_id: event.empleado_id,
            fecha: event.fecha,
            monto_original: normalizedAmount,
            moneda_original: event.moneda_original,
            monto_base: baseAmount,
            categoria: event.categoria,
            cost_center: event.cost_center,
          },
        });

        await this.jobRuns.finishStage({
          stageId: validationStageId,
          status: 'success',
          data: {
            status: validation.status,
            alertasCount: Array.isArray(validation.alertas) ? validation.alertas.length : 0,
            ...(Array.isArray(validation.alertas) ? { alertas: validation.alertas } : {}),
            ...(validation.politicas ? { politicas: validation.politicas } : {}),
          },
        });

        await this.jobRuns.mergeMeta(ctx.jobId, {
          validation: {
            status: validation.status,
            alertas: Array.isArray(validation.alertas) ? validation.alertas : [],
            ...(validation.politicas ? { politicas: validation.politicas } : {}),
          },
        });

        const persistStageId = await this.jobRuns.startStage(ctx.jobId, 'persist');

        await this.repo.upsertFromEvent({
          event,
          jobId: ctx.jobId,
          fingerprint,
          negativeAmountDetected,
          normalizedAmount,
          baseAmount,
          exchangeRate,
          validation,
        });

        await this.jobRuns.finishStage({
          stageId: persistStageId,
          status: 'success',
        });

        await this.jobRuns.finishRun(ctx.jobId, 'success');
        return;
      }

      await this.jobRuns.finishStage({
        stageId: currencyStageId,
        status: 'success',
        data: { baseAmount, tipo_cambio: exchangeRate },
      });

      const validationStageId = await this.jobRuns.startStage(ctx.jobId, 'validation');

      const validation = await this.validationClient.validate({
        gasto: {
          id: event.id,
          empleado_id: event.empleado_id,
          fecha: event.fecha,
          monto_original: normalizedAmount,
          moneda_original: event.moneda_original,
          monto_base: baseAmount,
          categoria: event.categoria,
          cost_center: event.cost_center,
        },
      });

      await this.jobRuns.finishStage({
        stageId: validationStageId,
        status: 'success',
        data: {
          status: validation.status,
          alertasCount: Array.isArray(validation.alertas) ? validation.alertas.length : 0,
          ...(Array.isArray(validation.alertas) && validation.alertas.length
            ? { alertas: validation.alertas }
            : {}),
          ...(validation.politicas ? { politicas: validation.politicas } : {}),
        },
      });

      await this.jobRuns.mergeMeta(ctx.jobId, {
        validation: {
          status: validation.status,
          alertas: Array.isArray(validation.alertas) ? validation.alertas : [],
          ...(validation.politicas ? { politicas: validation.politicas } : {}),
        },
      });

      const persistStageId = await this.jobRuns.startStage(ctx.jobId, 'persist');

      await this.repo.upsertFromEvent({
        event,
        jobId: ctx.jobId,
        fingerprint,
        negativeAmountDetected,
        normalizedAmount,
        baseAmount,
        exchangeRate,
        validation,
      });

      await this.jobRuns.finishStage({
        stageId: persistStageId,
        status: 'success',
      });

      await this.jobRuns.finishRun(ctx.jobId, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`jobId=${ctx.jobId} failed: ${message}`);
      await this.jobRuns.finishRun(ctx.jobId, 'failed');
      throw err;
    }
  }
}
