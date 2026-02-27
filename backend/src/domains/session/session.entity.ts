// /home/selub/Documents/progs/besafechat/backend/src/domains/session/session.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Identity } from '../identity/identity.entity';
import { Handle } from '../handle/handle.entity';

@Entity('sessions')
@Index('idx_sessions_identity_handle', ['identityId', 'activeHandleId'])
@Index('idx_sessions_last_active', ['lastActiveAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Связь с Identity
  @ManyToOne(() => Identity, (identity) => identity.sessions, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  identity!: Identity;

  @Column({ type: 'uuid' })
  identityId!: string;

  // ✅ Активный Handle для этой сессии
  @ManyToOne(() => Handle, { nullable: false })
  @JoinColumn({ name: 'activeHandleId' })
  activeHandle!: Handle;

  @Column({ type: 'uuid' })
  activeHandleId!: string;

  // Информация об устройстве
  @Column({ type: 'varchar', length: 100 })
  deviceName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType?: 'mobile' | 'desktop' | 'web';

  @Column({ type: 'bytea', nullable: true })
  devicePublicKey?: Buffer; // Для будущей E2EE

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  // Система токенов
  @Column({ type: 'text', unique: true })
  accessTokenHash!: string;

  @Column({ type: 'text', unique: true })
  refreshToken!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
