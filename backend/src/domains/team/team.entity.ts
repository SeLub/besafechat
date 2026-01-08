// /home/selub/Documents/progs/besafechat/backend/src/domains/team/team.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Handle } from '../handle/handle.entity';
import { Identity } from '../identity/identity.entity';
import { TeamMembership } from './team-membership.entity';
import { TeamInvite } from './team-invite.entity';

@Entity('teams')
@Index('idx_teams_slug', ['slug'])
@Index('idx_teams_parent', ['parentTeamId'])
@Index('idx_teams_owner', ['ownerIdentityId'])
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Handle типа 'team' для поиска и адресации
  @OneToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'handleId' })
  handle!: Handle;

  @Column({ type: 'uuid' })
  handleId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'jsonb', default: {} })
  namingPolicy!: {
    pattern: string;
    required: boolean;
    allowedCharacters?: string[];
    minLength?: number;
    maxLength?: number;
  };

  @ManyToOne(() => Team, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parentTeamId' })
  parentTeam?: Team;

  @Column({ type: 'uuid', nullable: true })
  parentTeamId?: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: {
    privacy?: {
      isPublic?: boolean;
      allowInvites?: boolean;
      requireApproval?: boolean;
    };
    chat?: {
      defaultChannels?: string[];
      autoJoinChannels?: boolean;
    };
    permissions?: {
      memberCanInvite?: boolean;
      memberCanCreateChannels?: boolean;
    };
  };

  @Column({ type: 'bytea', nullable: true })
  groupKey?: Buffer;

  @Column({ type: 'jsonb', nullable: true })
  encryptionSettings?: {
    keyRotationInterval?: number;
    forwardSecrecy?: boolean;
    signatureRequired?: boolean;
  };

  // Владелец команды (Identity для правовых вопросов)
  @ManyToOne(() => Identity, { nullable: false })
  @JoinColumn({ name: 'ownerIdentityId' })
  ownerIdentity!: Identity;

  @Column({ type: 'uuid' })
  ownerIdentityId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  // Связи с членами через Handle
  @OneToMany(() => TeamMembership, (membership) => membership.team)
  memberships!: TeamMembership[];

  @OneToMany(() => TeamInvite, (invite) => invite.team)
  invites!: TeamInvite[];

  @OneToMany(() => Team, (team) => team.parentTeam)
  childTeams!: Team[];
}
