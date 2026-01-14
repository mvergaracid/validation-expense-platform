import { DataSource } from 'typeorm';
import { createTypeOrmOptions } from './orm.config';

const fallbackUrl = 'postgres://postgres:postgres@localhost:5432/expense-validation-db';

const options = (() => {
  try {
    return createTypeOrmOptions();
  } catch {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL ?? fallbackUrl,
      synchronize: false,
      ssl: false,
    };
  }
})();

export default new DataSource({
  ...options,
  migrations: ['src/persistence/migrations/*.ts'],
});
