import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL es requerido');
}

export default new DataSource({
  type: 'postgres',
  url,
  synchronize: false,
  ssl: (process.env.DATABASE_SSL ?? 'false') === 'true' ? { rejectUnauthorized: false } : false,
  migrations: ['src/migrations/*.ts'],
});
