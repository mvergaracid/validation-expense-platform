import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFileProcessBatches1700000000100 implements MigrationInterface {
  name = 'CreateFileProcessBatches1700000000100';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS file_process_batches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        process_id uuid NOT NULL,
        batch_index integer NOT NULL,
        record_count integer NOT NULL,
        expense_ids jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_file_process_batches_process_id ON file_process_batches(process_id)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS uq_file_process_batches_process_batch ON file_process_batches(process_id, batch_index)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_file_process_batches_process_batch');
    await queryRunner.query('DROP INDEX IF EXISTS idx_file_process_batches_process_id');
    await queryRunner.query('DROP TABLE IF EXISTS file_process_batches');
  }
}
