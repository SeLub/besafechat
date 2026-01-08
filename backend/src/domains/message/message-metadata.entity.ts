// /home/selub/Documents/progs/besafechat/backend/src/domains/message/message-metadata.entity.ts
// Для приватных чатов: chat_id = chat.id
// Для каналов: chat_id = channel.id
// Для командных чатов: chat_id = team_chat.id (если будут)

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Handle } from '../handle/handle.entity';

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'system';

@Entity('message_metadata')
@Index('idx_message_metadata_chat', ['chatId', 'createdAt'])
@Index('idx_message_metadata_sender', ['senderHandleId', 'createdAt'])
@Index('idx_message_metadata_pinned', ['chatId'], { where: '"isPinned" = true' })
export class MessageMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Chat ID (может быть chat.id или channel.id)
  @Column({ type: 'uuid' })
  chatId!: string;

  // Отправитель через Handle (type='account')
  @ManyToOne(() => Handle, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'senderHandleId' })
  senderHandle!: Handle;

  @Column({ type: 'uuid' })
  senderHandleId!: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['text', 'image', 'file', 'audio', 'video', 'system'],
    default: 'text',
  })
  type!: MessageType;

  // Заголовок сообщения (для системных сообщений)
  @Column({ type: 'text', nullable: true })
  title?: string;

  // Текст сообщения (может быть null для медиа)
  @Column({ type: 'text', nullable: true })
  text?: string;

  // Медиа файлы (ссылка на Tebi S3)
  @Column({ type: 'text', nullable: true })
  mediaUrl?: string; // Ссылка на медиа в Tebi S3

  @Column({ type: 'bigint', nullable: true })
  mediaSize?: number; // Размер медиа в байтах

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType?: string; // MIME-тип

  @Column({ type: 'text', nullable: true })
  thumbnailUrl?: string; // Превью для медиа

  @Column({ type: 'float', nullable: true })
  duration?: number; // Длительность аудио/видео в секундах

  // Геолокация
  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  // Ответ на сообщение
  @Column({ type: 'uuid', nullable: true })
  replyToMessageId?: string;

  // Для будущей E2EE
  @Column({ type: 'bytea', nullable: true })
  encryptedKey?: Buffer; // Зашифрованный ключ для расшифровки

  // Временные метки
  @Column({ type: 'timestamptz' })
  timestamp!: Date; // Время отправки (клиентское)

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date; // Время получения сервером

  @Column({ type: 'timestamptz', nullable: true })
  editedAt?: Date; // Время редактирования

  // Флаги
  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean; // Мягкое удаление

  @Column({ type: 'boolean', default: false })
  isPinned!: boolean; // Закрепленное сообщение

  // Реакции
  @Column({ type: 'jsonb', default: [] })
  reactions!: Array<{
    emoji: string;
    handleId: string; // Handle пользователя, поставившего реакцию
    timestamp: Date;
  }>;

  // Дополнительные метаданные для расширения
  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    // Для голосовых сообщений
    waveform?: number[];
    transcribedText?: string;

    // Для файлов
    fileName?: string;
    fileHash?: string;

    // Для изображений
    width?: number;
    height?: number;

    // Системные метаданные
    systemAction?: string;
    systemParams?: Record<string, any>;

    [key: string]: any;
  };

  // Хеш сообщения для дедупликации
  @Column({ type: 'varchar', length: 64, nullable: true })
  contentHash?: string;
}
