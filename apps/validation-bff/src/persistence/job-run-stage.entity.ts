import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type JobStageStatus = 'running' | 'success' | 'failed' | 'skipped';

@Entity({ name: 'job_run_stages' })
export class JobRunStageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  job_id!: string;

  @Column({ type: 'varchar' })
  stage!: string;

  @Column({ type: 'varchar' })
  status!: JobStageStatus;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
