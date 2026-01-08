// /home/selub/Documents/progs/besafechat/backend/src/domains/team/team-invite.entity.ts
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
import { Handle } from '../handle/handle.entity';
import { Team } from './team.entity';

export enum TeamInviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

@Entity('team_invites')
@Index('idx_team_invites_invited', ['invitedHandleId', 'status'])
@Index('idx_team_invites_team', ['teamId', 'status'])
export class TeamInvite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'teamId' })
  team!: Team;

  @Column({ type: 'uuid' })
  teamId!: string;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'inviterHandleId' })
  inviterHandle!: Handle;

  @Column({ type: 'uuid' })
  inviterHandleId!: string;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'invitedHandleId' })
  invitedHandle!: Handle;

  @Column({ type: 'uuid' })
  invitedHandleId!: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: TeamInviteStatus,
    default: TeamInviteStatus.PENDING,
  })
  status!: TeamInviteStatus;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'text', nullable: true })
  message?: string;

  // Для отслеживания принятия приглашения
  @Column({ type: 'uuid', nullable: true })
  acceptedMembershipId?: string;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  declinedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  // Инвайт-токен для ссылок приглашения
  @Column({ type: 'text', unique: true })
  token!: string;
}
