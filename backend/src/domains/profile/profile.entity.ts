// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/profile.entity.ts
// Профиль создается только для Handle с типом 'account' (это нужно проверять в бизнес-логике)
// Примечание: В ТЗ указано, что email и phone - приватные данные, не для поиска. Это значит, что их не следует индексировать для публичного поиска. Также важно, что в бизнес-логике должна быть проверка, что связанный Handle имеет тип 'account'.
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Identity } from '../identity/identity.entity';

@Entity('profiles')
@Index('idx_profiles_identity', ['identityId'])
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  identityId!: string;

  @ManyToOne(() => Identity, (identity) => identity.profiles, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  identity!: Identity;

  // Персональные данные
  @Column({ type: 'varchar', length: 100 })
  displayName!: string; // Отображаемое имя (обязательное)

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName?: string; // Реальное имя

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName?: string; // Фамилия

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string; // Контактные данные (приватные, не для поиска)

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string; // Контактные данные (приватные, не для поиска)

  @Column({ type: 'text', nullable: true })
  avatarUrl?: string; // Ссылка на аватар в Tebi S3

  @Column({ type: 'text', nullable: true })
  bio?: string; // Описание/статус

  // Настройки
  @Column({ type: 'jsonb', default: {} })
  settings!: {
    // Настройки видимости и поведения
    showEmail?: boolean;
    showPhone?: boolean;
    showPresence?: boolean;
    [key: string]: any; // Другие настройки
  };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
