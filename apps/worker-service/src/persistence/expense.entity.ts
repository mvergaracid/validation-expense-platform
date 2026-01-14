import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'expenses' })
export class ExpenseEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  job_id!: string | null;

  @Column({ type: 'varchar' })
  empleado_id!: string;

  @Column({ type: 'varchar' })
  fecha!: string;

  @Column({ type: 'numeric' })
  monto_original!: number;

  @Column({ type: 'varchar' })
  moneda_original!: string;

  @Column({ type: 'varchar' })
  categoria!: string;

  @Column({ type: 'varchar' })
  cost_center!: string;

  @Index()
  @Column({ type: 'varchar' })
  fingerprint!: string;

  @Column({ type: 'boolean', default: false })
  negative_amount_detected!: boolean;

  @Column({ type: 'numeric', nullable: true })
  monto_base!: number | null;

  @Column({ type: 'numeric', nullable: true })
  tipo_cambio!: number | null;

  @Column({ type: 'varchar', nullable: true })
  validation_status!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  validation_alerts!: unknown[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
