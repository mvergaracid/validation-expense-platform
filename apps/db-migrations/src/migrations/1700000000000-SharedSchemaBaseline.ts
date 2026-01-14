import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharedSchemaBaseline1700000000000 implements MigrationInterface {
  name = 'SharedSchemaBaseline1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_runs (
        job_id uuid PRIMARY KEY,
        pattern varchar NOT NULL,
        expense_id varchar NULL,
        fingerprint varchar NULL,
        status varchar NOT NULL,
        finished_at timestamptz NULL,
        meta jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_run_stages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id uuid NOT NULL,
        stage varchar NOT NULL,
        status varchar NOT NULL,
        finished_at timestamptz NULL,
        data jsonb NULL,
        error text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_job_run_stages_job_id ON job_run_stages(job_id)');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS file_processes (
        process_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        filename varchar NOT NULL,
        storage_uri varchar NOT NULL,
        status varchar NOT NULL,
        total_records integer NOT NULL DEFAULT 0,
        published_batches integer NOT NULL DEFAULT 0,
        error_message text NULL,
        finished_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id varchar PRIMARY KEY,
        job_id uuid NULL,
        empleado_id varchar NOT NULL,
        fecha varchar NOT NULL,
        monto_original numeric NOT NULL,
        moneda_original varchar NOT NULL,
        categoria varchar NOT NULL,
        cost_center varchar NOT NULL,
        fingerprint varchar NOT NULL,
        negative_amount_detected boolean NOT NULL DEFAULT false,
        monto_base numeric NULL,
        tipo_cambio numeric NULL,
        validation_status varchar NULL,
        validation_alerts jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS job_id uuid NULL');
    await queryRunner.query('ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tipo_cambio numeric NULL');

    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_expenses_job_id ON expenses(job_id)');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_fingerprint ON expenses(fingerprint)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_expenses_fingerprint');
    await queryRunner.query('DROP INDEX IF EXISTS idx_expenses_job_id');

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'expenses'
        ) THEN
          ALTER TABLE expenses DROP COLUMN IF EXISTS tipo_cambio;
          ALTER TABLE expenses DROP COLUMN IF EXISTS job_id;
        END IF;
      END $$;
    `);

    await queryRunner.query('DROP TABLE IF EXISTS file_processes');

    await queryRunner.query('DROP INDEX IF EXISTS idx_job_run_stages_job_id');
    await queryRunner.query('DROP TABLE IF EXISTS job_run_stages');
    await queryRunner.query('DROP TABLE IF EXISTS job_runs');
  }
}
