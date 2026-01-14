import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type FileProcessStatus = 'PROCESANDO' | 'COMPLETADO' | 'ERROR';

@Entity({ name: 'file_processes' })
export class FileProcessEntity {
  @PrimaryGeneratedColumn('uuid')
  process_id!: string;

  @Column({ type: 'varchar' })
  filename!: string;

  @Column({ type: 'varchar' })
  storage_uri!: string;

  @Column({ type: 'varchar' })
  status!: FileProcessStatus;

  @Column({ type: 'integer', default: 0 })
  total_records!: number;

  @Column({ type: 'integer', default: 0 })
  published_batches!: number;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
