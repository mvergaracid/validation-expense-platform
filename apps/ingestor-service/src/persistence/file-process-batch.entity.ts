import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'file_process_batches' })
export class FileProcessBatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  process_id!: string;

  @Column({ type: 'integer' })
  batch_index!: number;

  @Column({ type: 'integer' })
  record_count!: number;

  @Column({ type: 'jsonb', nullable: true })
  expense_ids!: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
