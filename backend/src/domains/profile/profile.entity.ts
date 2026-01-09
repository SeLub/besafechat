// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/profile.entity.ts
// Профиль создается только для Handle с типом 'account' (это нужно проверять в бизнес-логике)
// Примечание: В ТЗ указано, что email и phone - приватные данные, не для поиска. Это значит, что их не следует индексировать для публичного поиска. Также важно, что в бизнес-логике должна быть проверка, что связанный Handle имеет тип 'account'.
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Handle } from '../handle/handle.entity';

@Entity('profiles')
@Index('idx_profiles_handle', ['handleId'])
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Связь 1:1 с Handle типа 'account'
  @OneToOne(() => Handle, (handle) => handle.profile, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'handleId' })
  handle!: Handle;

  @Column({ type: 'uuid', unique: true })
  handleId!: string; // Ссылка на Handle типа 'account'

  // ... остальные поля без изменений
  @Column({ type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: {
    showEmail?: boolean;
    showPhone?: boolean;
    showPresence?: boolean;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
