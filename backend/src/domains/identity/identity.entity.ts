//home/selub/Documents/progs/besafechat/backend/src/domains/identity/identity.entity.ts
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChatMember } from '../chat/chat-member.entity';
import { Handle } from '../handle/handle.entity';
import { Profile } from '../profile/profile.entity';
import { Session } from '../session/session.entity';
import { TeamMembership } from '../team/team-membership.entity';

@Entity('identities')
export class Identity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bytea', unique: true, nullable: true })
  masterPublicKey?: Buffer; // Ed25519 public key for future E2EE

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Relationships
  @OneToMany(() => Handle, (handle) => handle.ownerIdentity)
  handles!: Handle[];

  @OneToMany(() => Profile, (profile) => profile.identity)
  profiles!: Profile[];

  @OneToMany(() => Session, (session) => session.identity)
  sessions!: Session[];

  @OneToMany(() => ChatMember, (member) => member.memberHandle.ownerIdentity)
  chatMemberships!: ChatMember[];

  @OneToMany(() => TeamMembership, (membership) => membership.memberHandle.ownerIdentity)
  teamMemberships!: TeamMembership[];
}
