import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidationPolicyEntity } from './validation-policy.entity';

@Injectable()
export class ValidationPolicyRepository {
  constructor(
    @InjectRepository(ValidationPolicyEntity)
    private readonly repo: Repository<ValidationPolicyEntity>,
  ) {}

  async getCurrent(): Promise<Record<string, unknown> | null> {
    const entity = await this.repo.findOne({ where: { name: 'current' } });
    return entity?.policies ?? null;
  }
}
