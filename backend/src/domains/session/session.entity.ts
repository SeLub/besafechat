// /home/selub/Documents/progs/besafechat/backend/src/domains/session/session.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Identity } from '../identity/identity.entity';

@Entity('sessions')
@Index('idx_sessions_identity', ['identityId', 'isActive'])
@Index('idx_sessions_last_active', ['lastActiveAt'], { where: '"isActive" = true' })
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

  // Информация об устройстве (из DeviceService)
  @Column({ type: 'varchar', length: 100 })
  deviceName!: string; // Например: "iPhone 13", "Windows"

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType?: 'mobile' | 'desktop' | 'web'; // Тип устройства

  @Column({ type: 'bytea', nullable: true })
  devicePublicKey?: Buffer; // Для будущей E2EE

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  // Система токенов (существующая функциональность)
  @Column({ type: 'text', unique: true })
  accessTokenHash!: string; // Хеш access token (для проверки при отзыве)

  @Column({ type: 'text', unique: true })
  refreshToken!: string; // Refresh token (длинный, случайный)

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  // Статус сессии
  @Column({ type: 'boolean', default: true })
  isActive!: boolean; // Активна ли сессия

  @Column({ type: 'boolean', default: false })
  revoked!: boolean; // Признак отозванной сессии

  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt?: Date; // Время последней активности

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
