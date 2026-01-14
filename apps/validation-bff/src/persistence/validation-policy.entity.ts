import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'validation_policies' })
export class ValidationPolicyEntity {
  @PrimaryColumn({ type: 'varchar' })
  name!: string;

  @Column({ type: 'jsonb' })
  policies!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
