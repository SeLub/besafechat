// src/domains/user/session.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  user!: User;

  @Column({ type: 'text' })
  deviceId!: string;

  @Column({ type: 'text', nullable: true })
  deviceModel?: string;

  @Column({ type: 'inet', nullable: true })
  ipAddress?: string;

  // Хеш access token (для проверки при отзыве)
  @Column({ type: 'text', unique: true })
  accessTokenHash!: string;

  // Refresh token (длинный, случайный)
  @Column({ type: 'text', unique: true })
  refreshToken!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastActiveAt!: Date;
}
