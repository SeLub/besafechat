// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/handle.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Identity } from '../identity/identity.entity';
import { TeamInvite } from '../team/team-invite.entity';
import { TeamMembership } from '../team/team-membership.entity';
import { Profile } from '../profile/profile.entity';
import { ChatMember } from '../chat/chat-member.entity';
import { ContactRequest } from '../contact/contact-request.entity';
import { MessageMetadata } from '../message/message-metadata.entity';

export type HandleType = 'account' | 'team' | 'channel';

@Entity('handles')
@Index('idx_handles_search', ['value', 'alias'], { where: '"isSearchable" = true' })
@Index('idx_handles_alias', ['alias'], { unique: true, where: 'alias IS NOT NULL' })
export class Handle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  value!: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['account', 'team', 'channel'],
  })
  type!: HandleType;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  alias?: string | null;

  @Column({ type: 'boolean', default: false })
  isSearchable!: boolean;

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Связь с Identity (владелец)
  @ManyToOne(() => Identity, (identity) => identity.handles, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  ownerIdentity!: Identity;

  @Column({ type: 'uuid' })
  ownerIdentityId!: string;

  // Связь 1:1 с Profile (только для type='account')
  @OneToOne(() => Profile, (profile) => profile.handle, {
    nullable: true,
    cascade: true,
  })
  profile?: Profile;

  // Связи для команд
  @OneToMany(() => TeamMembership, (membership) => membership.memberHandle)
  teamMemberships!: TeamMembership[];

  @OneToMany(() => TeamInvite, (invite) => invite.invitedHandle)
  teamInvitesReceived!: TeamInvite[];

  @OneToMany(() => TeamInvite, (invite) => invite.inviterHandle)
  teamInvitesSent!: TeamInvite[];

  // Дополнительные связи
  @OneToMany(() => ChatMember, (member) => member.memberHandle)
  chatMemberships!: ChatMember[];

  @OneToMany(() => ContactRequest, (req) => req.fromHandle)
  sentContactRequests!: ContactRequest[];

  @OneToMany(() => ContactRequest, (req) => req.toHandle)
  receivedContactRequests!: ContactRequest[];

  @OneToMany(() => MessageMetadata, (msg) => msg.senderHandle)
  sentMessages!: MessageMetadata[];
}
