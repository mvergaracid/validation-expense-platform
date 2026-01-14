import { DataSourceOptions } from 'typeorm';
import { FileProcessEntity } from './file-process.entity';
import { FileProcessBatchEntity } from './file-process-batch.entity';

export const createTypeOrmOptions = (): DataSourceOptions => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL es requerido');
  }

  return {
    type: 'postgres',
    url,
    entities: [FileProcessEntity, FileProcessBatchEntity],
    synchronize: false,
    ssl:
      (process.env.DATABASE_SSL ?? 'false') === 'true'
        ? { rejectUnauthorized: false }
        : false,
  };
};
