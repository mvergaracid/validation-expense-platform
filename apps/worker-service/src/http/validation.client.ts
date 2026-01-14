import { Injectable } from '@nestjs/common';
import { BaseHttpService } from './base-http.service';
import { ValidationPolicyRepository } from '../persistence/validation-policy.repository';

interface WorkerValidationRequest {
  gasto: {
    id: string;
    empleado_id: string;
    fecha: string;
    monto_original: number;
    moneda_original: string;
    monto_base: number;
    categoria: string;
    cost_center: string;
  };
  politicas?: unknown;
}

@Injectable()
export class ValidationClient {
  private cachedPolicies: unknown | null = null;
  private cachedAtMs = 0;

  constructor(
    private readonly http: BaseHttpService,
    private readonly policyRepo: ValidationPolicyRepository,
  ) {}

  private async getDefaultPolicies(): Promise<unknown | undefined> {
    const ttlMs = Number(process.env.POLICIES_CACHE_TTL_MS ?? 5000);
    const now = Date.now();
    if (this.cachedPolicies !== null && now - this.cachedAtMs < ttlMs) {
      return this.cachedPolicies;
    }

    const fromDb = await this.policyRepo.getCurrent();
    if (fromDb) {
      this.cachedPolicies = fromDb;
      this.cachedAtMs = now;
      return fromDb;
    }

    const policiesRaw = process.env.DEFAULT_POLICIES;
    const parsed = policiesRaw ? JSON.parse(policiesRaw) : undefined;
    this.cachedPolicies = parsed ?? undefined;
    this.cachedAtMs = now;
    return parsed;
  }

  async validate(input: WorkerValidationRequest): Promise<{
    status: string;
    alertas: unknown[];
    politicas: unknown | undefined;
  }> {
    const baseUrl = process.env.VALIDATION_SERVICE_URL;
    if (!baseUrl) {
      throw new Error('VALIDATION_SERVICE_URL es requerido');
    }

    const url = `${baseUrl.replace(/\/$/, '')}/validations`;

    const politicas = input.politicas ?? (await this.getDefaultPolicies());

    const payload: WorkerValidationRequest = {
      ...input,
      politicas,
    };

    const res = await this.http.post<{ gasto_id: string; status: string; alertas: unknown[] }>(
      url,
      payload,
    );

    return {
      status: res.status,
      alertas: Array.isArray(res.alertas) ? res.alertas : [],
      politicas,
    };
  }
}
