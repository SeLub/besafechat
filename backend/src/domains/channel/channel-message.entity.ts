// /home/selub/Documents/progs/besafechat/backend/src/domains/channel/channel-message.entity.ts
// Для ChannelMessage:
//     Отдельное хранилище для публичного контента
//     Поддержка модерации (isDeleted, deletionReason)
//     Статистика и аналитика (viewCount, shareCount)
//     Гибридный подход:
//         Публичные каналы: контент в content
//         Приватные каналы: контент в encryptedContent
//     Медиа и форматирование
//     Поиск и индексация (можно добавить полнотекстовый поиск)

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel } from './channel.entity';
import { Handle } from '../handle/handle.entity';

@Entity('channel_messages')
@Index('idx_channel_messages_channel', ['channelId', 'createdAt'])
@Index('idx_channel_messages_sender', ['senderHandleId', 'createdAt'])
export class ChannelMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE', nullable: false })
  channel!: Channel;

  @Column({ type: 'uuid' })
  channelId!: string;

  @ManyToOne(() => Handle, { nullable: false })
  senderHandle!: Handle;

  @Column({ type: 'uuid' })
  senderHandleId!: string;

  // Для публичных каналов - контент хранится открыто
  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 20, default: 'text' })
  contentType!: 'text' | 'image' | 'video' | 'file' | 'poll';

  // Медиа файлы (хранятся в S3, ссылки зашифрованы)
  @Column({ type: 'jsonb', nullable: true })
  media?: {
    url: string;
    thumbnailUrl?: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number; // для видео/аудио
  };

  // Для гибридного шифрования (если канал приватный)
  @Column({ type: 'bytea', nullable: true })
  encryptedContent?: Buffer; // Зашифрованный контент для приватных каналов

  @Column({ type: 'bytea', nullable: true })
  encryptionKey?: Buffer; // Ключ шифрования (зашифрованный broadcastKey)

  // Метаданные
  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    mentions?: string[]; // Упоминания handle'ов
    hashtags?: string[]; // Хэштеги
    links?: Array<{ url: string; title?: string; description?: string }>;
    reactions?: Record<string, number>; // { '👍': 5, '❤️': 3 }
  };

  // Модерация
  @Column({ type: 'boolean', default: false })
  isPinned!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string; // Handle модератора

  @Column({ type: 'text', nullable: true })
  deletionReason?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt?: Date;

  // Статистика (денорализована для производительности)
  @Column({ type: 'integer', default: 0 })
  viewCount!: number;

  @Column({ type: 'integer', default: 0 })
  shareCount!: number;

  // Для тредов/ответов
  @Column({ type: 'uuid', nullable: true })
  parentMessageId?: string; // Ответ на другое сообщение

  @Column({ type: 'integer', default: 0 })
  replyCount!: number;
}
