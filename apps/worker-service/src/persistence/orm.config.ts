import { DataSourceOptions } from 'typeorm';
import { ExpenseEntity } from './expense.entity';
import { JobRunEntity } from './job-run.entity';
import { JobRunStageEntity } from './job-run-stage.entity';
import { ValidationPolicyEntity } from './validation-policy.entity';

export const createTypeOrmOptions = (): DataSourceOptions => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL es requerido');
  }

  return {
    type: 'postgres',
    url,
    entities: [ExpenseEntity, JobRunEntity, JobRunStageEntity, ValidationPolicyEntity],
    synchronize: false,
    ssl: (process.env.DATABASE_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
  };
};
