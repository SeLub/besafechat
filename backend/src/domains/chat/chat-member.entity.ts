// /home/selub/Documents/progs/besafechat/backend/src/domains/chat/chat-member.entity.ts
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Handle } from '../handle/handle.entity';
import { Chat } from './chat.entity';

@Entity('chat_members')
export class ChatMember {
  @PrimaryColumn('uuid')
  chatId!: string;

  @PrimaryColumn('uuid')
  memberHandleId!: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  chat!: Chat;

  @ManyToOne(() => Handle, { onDelete: 'CASCADE' })
  memberHandle!: Handle;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'member',
  })
  role!: string; // 'member' (для симметрии), 'admin', 'owner'

 @Column({ type: 'boolean', default: true })
  canSendMessages!: boolean;

  @Column({ type: 'jsonb', default: {} })
  notificationSettings!: {
    mute?: boolean;
    mentionsOnly?: boolean;
    customSound?: string;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;
}
