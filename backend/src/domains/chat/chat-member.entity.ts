import { Entity, PrimaryColumn, ManyToOne, CreateDateColumn, Column } from 'typeorm';
import { User } from '../user/user.entity';
import { Chat } from './chat.entity';

@Entity('chat_members')
export class ChatMember {
  @PrimaryColumn('uuid')
  chatId!: string;

  @PrimaryColumn('uuid')
  userId!: string;

  @ManyToOne(() => Chat, (chat) => chat.members, { onDelete: 'CASCADE' })
  chat!: Chat;

  @ManyToOne(() => User, (user) => user.chatMemberships, { onDelete: 'CASCADE' })
  user!: User;

  // Роль: 'member', 'admin', 'owner'
  @Column({ type: 'text', default: 'member' })
  role!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;
}
