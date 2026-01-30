import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('claimed_recovery_passwords')
export class ClaimedRecoveryPassword {
  @PrimaryColumn({ type: 'text' }) // Primary key - no relation to identity
  password_hash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  claimed_at!: Date;
}
