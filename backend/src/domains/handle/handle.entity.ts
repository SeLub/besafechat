// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/handle.entity.ts

// Примечание: В ТЗ указано, что alias можно менять, а value - никогда. Это логика должна быть реализована на уровне сервиса/бизнес-логики, так как TypeORM не предоставляет прямого способа сделать поле неизменяемым после создания.

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Identity } from '../identity/identity.entity';
import { TeamInvite } from '../team/team-invite.entity';
import { TeamMembership } from '../team/team-membership.entity';

export type HandleType = 'account' | 'team' | 'channel';

@Entity('handles')
@Index('idx_handles_search', ['value', 'alias'], { where: '"isSearchable" = true' })
@Index('idx_handles_alias', ['alias'], { unique: true, where: 'alias IS NOT NULL' })
export class Handle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  value!: string; // Технический уникальный идентификатор (никогда не меняется)

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['account', 'team', 'channel'],
  })
  type!: HandleType;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  alias?: string; // Красивое имя для поиска и отображения

  @Column({ type: 'boolean', default: false })
  isSearchable!: boolean; // Доступен для глобального поиска

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean; // Основной хэндл для отображения

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Связи
  @ManyToOne(() => Identity, (identity) => identity.handles, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  ownerIdentity!: Identity;

  @Column({ type: 'uuid' })
  ownerIdentityId!: string; // Владелец (создатель) Handle

  // Связи для команд (только для type='account')
  @OneToMany(() => TeamMembership, (membership) => membership.memberHandle)
  teamMemberships!: TeamMembership[];

  @OneToMany(() => TeamInvite, (invite) => invite.invitedHandle)
  teamInvitesReceived!: TeamInvite[];

  @OneToMany(() => TeamInvite, (invite) => invite.inviterHandle)
  teamInvitesSent!: TeamInvite[];
}
