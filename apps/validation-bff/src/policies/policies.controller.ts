import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationPolicyEntity } from '../persistence/validation-policy.entity';

@Controller()
export class PoliciesController {
  constructor(
    @InjectRepository(ValidationPolicyEntity)
    private readonly policies: Repository<ValidationPolicyEntity>,
  ) {}

  private validatePolicyShape(policies: unknown): asserts policies is Record<string, unknown> {
    if (!policies || typeof policies !== 'object' || Array.isArray(policies)) {
      throw new BadRequestException('policies debe ser un objeto JSON');
    }

    const p = policies as any;
    const errors: string[] = [];

    if (typeof p.moneda_base !== 'string' || !p.moneda_base.trim().length) {
      errors.push('Falta campo requerido: moneda_base (string)');
    }

    if (p.politicas !== undefined && !Array.isArray(p.politicas)) {
      errors.push('Campo inválido: politicas debe ser un array');
    }

    if (errors.length) {
      throw new BadRequestException(errors.join('. '));
    }
  }

  @Get('policies/current')
  async getCurrent(): Promise<{ name: string; policies: Record<string, unknown>; updated_at: Date; created_at: Date } | null> {
    const entity = await this.policies.findOne({ where: { name: 'current' } });
    if (entity) return entity;

    const raw = process.env.DEFAULT_POLICIES;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    this.validatePolicyShape(parsed);

    const now = new Date();
    return {
      name: 'current',
      policies: parsed as Record<string, unknown>,
      created_at: now,
      updated_at: now,
    };
  }

  @Put('policies/current')
  async setCurrent(
    @Body() body: unknown,
  ): Promise<{ name: string; policies: Record<string, unknown>; updated_at: Date; created_at: Date }> {
    let policies: unknown = body;
    if (body && typeof body === 'object' && !Array.isArray(body) && 'policies' in (body as any)) {
      const candidate = (body as any).policies;
      if (candidate !== undefined) {
        policies = candidate;
      }
    }

    this.validatePolicyShape(policies);

    const entity = this.policies.create({
      name: 'current',
      policies: policies as Record<string, unknown>,
    });

    return this.policies.save(entity);
  }
}
