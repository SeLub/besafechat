import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { ChatMember } from './chat-member.entity';
import { MessageMetadata } from '../message/message-metadata.entity';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Тип: 'private' | 'group' (в будущем)
  @Column({ type: 'text', default: 'private' })
  type!: string;

  // Название группы (для групповых чатов)
  @Column({ type: 'text', nullable: true })
  title!: string;

  // Аватар чата (URL к медиа)
  @Column({ type: 'text', nullable: true })
  avatarUrl!: string;

  @OneToMany(() => ChatMember, (member) => member.chat)
  members!: ChatMember[];

  @OneToMany(() => MessageMetadata, (message) => message.chat)
  messages!: MessageMetadata[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
