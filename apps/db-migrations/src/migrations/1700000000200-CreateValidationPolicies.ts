import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateValidationPolicies1700000000200 implements MigrationInterface {
  name = 'CreateValidationPolicies1700000000200';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS validation_policies (
        name varchar PRIMARY KEY,
        policies jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS validation_policies');
  }
}
