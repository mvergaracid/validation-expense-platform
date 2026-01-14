import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUniqueExpenseFingerprint1700000000300 implements MigrationInterface {
  name = 'DropUniqueExpenseFingerprint1700000000300';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_expenses_fingerprint');
    await queryRunner.query('DROP INDEX IF EXISTS idx_expenses_fingerprint');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_expenses_fingerprint ON expenses(fingerprint)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_expenses_fingerprint');
    await queryRunner.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_expenses_fingerprint ON expenses(fingerprint)');
  }
}
