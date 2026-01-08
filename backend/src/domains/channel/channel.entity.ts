// /home/selub/Documents/progs/besafechat/backend/src/domains/channel/channel.entity.ts
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
} from 'typeorm';
import { Handle } from '../handle/handle.entity';
import { Identity } from '../identity/identity.entity';
import { ChannelSubscriber } from './channel-subscriber.entity';
import { ChannelMessage } from './channel-message.entity';

@Entity('channels')
@Index('idx_channels_public', ['isPublic', 'createdAt'], { where: '"isPublic" = true' })
@Index('idx_channels_owner', ['ownerIdentityId'])
@Index('idx_channels_last_activity', ['lastBroadcastAt'], { where: '"lastBroadcastAt" IS NOT NULL' })
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Handle типа 'channel' для поиска и адресации
  @OneToOne(() => Handle, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'handleId' })
  handle!: Handle;

  @Column({ type: 'uuid' })
  handleId!: string;

  @Column({ type: 'boolean', default: false })
  isPublic!: boolean;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: {
    moderation?: {
      autoDeleteSpam?: boolean;
      requireApproval?: boolean;
      bannedWords?: string[];
    };
    permissions?: {
      allowReactions?: boolean;
      allowComments?: boolean;
      allowSharing?: boolean;
    };
    limits?: {
      maxSubscribers?: number;
      messageRateLimit?: number;
    };
  };

  // E2EE для приватных каналов
  @Column({ type: 'bytea', nullable: true })
  broadcastKey?: Buffer;

  @Column({ type: 'jsonb', nullable: true })
  encryptionSettings?: {
    algorithm?: string;
    keyRotationInterval?: number;
    forwardSecrecy?: boolean;
  };

  // Владелец канала
  @ManyToOne(() => Identity, { nullable: false })
  @JoinColumn({ name: 'ownerIdentityId' })
  ownerIdentity!: Identity;

  @Column({ type: 'uuid' })
  ownerIdentityId!: string;

  // Метаданные
  @Column({ type: 'text', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastBroadcastAt?: Date;

  @Column({ type: 'integer', default: 0 })
  subscriberCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Связи
  @OneToMany(() => ChannelSubscriber, (subscriber) => subscriber.channel)
  subscribers!: ChannelSubscriber[];

  @OneToMany(() => ChannelMessage, (message) => message.channel)
  messages!: ChannelMessage[];
}
