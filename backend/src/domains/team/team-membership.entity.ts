// /home/selub/Documents/progs/besafechat/backend/src/domains/team/team-membership.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Handle } from '../handle/handle.entity';
import { Team } from './team.entity';

@Entity('team_memberships')
@Index('idx_team_memberships_handle', ['memberHandleId'])
export class TeamMembership {
  @PrimaryColumn('uuid')
  teamId!: string;

  @PrimaryColumn('uuid')
  memberHandleId!: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team!: Team;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'memberHandleId' })
  memberHandle!: Handle;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'member',
  })
  role!: 'member' | 'moderator' | 'admin' | 'owner';

  @Column({ type: 'uuid', nullable: true })
  invitedByHandleId?: string;

  @ManyToOne(() => Handle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invitedByHandleId' })
  invitedByHandle?: Handle;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  // Для E2EE - персональный ключ, зашифрованный групповым ключом команды
  @Column({ type: 'bytea', nullable: true })
  encryptedMemberKey?: Buffer;

  // Настройки пользователя в команде
  @Column({ type: 'jsonb', default: {} })
  preferences!: {
    notifications?: {
      mentionsOnly?: boolean;
      muteTeam?: boolean;
      customSound?: string;
    };
    display?: {
      theme?: string;
      sortOrder?: string;
    };
  };
}
