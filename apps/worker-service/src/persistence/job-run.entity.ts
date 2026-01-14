import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type JobRunStatus = 'running' | 'success' | 'failed' | 'skipped';

@Entity({ name: 'job_runs' })
export class JobRunEntity {
  @PrimaryColumn({ type: 'uuid' })
  job_id!: string;

  @Column({ type: 'varchar' })
  pattern!: string;

  @Column({ type: 'varchar', nullable: true })
  expense_id!: string | null;

  @Column({ type: 'varchar', nullable: true })
  fingerprint!: string | null;

  @Column({ type: 'varchar' })
  status!: JobRunStatus;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
