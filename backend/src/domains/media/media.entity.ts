// /home/selub/Documents/progs/besafechat/backend/src/domains/media/media.entity.ts
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Identity } from '../identity/identity.entity';
import { MessageMetadata } from '../message/message-metadata.entity';

@Entity('media')
@Index('idx_media_uploader', ['uploaderIdentityId'])
@Index('idx_media_chat', ['chatId'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Ключ в Tebi S3 (уникальный)
  @Column({ type: 'text', unique: true })
  storageKey!: string;

  // Оригинальное имя файла
  @Column({ type: 'text', nullable: true })
  originalFilename?: string;

  // MIME-тип
  @Column({ type: 'varchar', length: 100 })
  mimeType!: string;

  // Размер файла в байтах
  @Column({ type: 'bigint' })
  size!: number;

  // Размеры для изображений/видео
  @Column({ type: 'integer', nullable: true })
  width?: number;

  @Column({ type: 'integer', nullable: true })
  height?: number;

  // Длительность для аудио/видео
  @Column({ type: 'float', nullable: true })
  duration?: number;

  // Хеш файла для дедупликации
  @Column({ type: 'text', nullable: true })
  fileHash?: string;

  // Загрузивший (Identity)
  @ManyToOne(() => Identity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaderIdentityId' })
  uploaderIdentity?: Identity;

  @Column({ type: 'uuid', nullable: true })
  uploaderIdentityId?: string;

  // Связь с чатом (где было загружено)
  @Column({ type: 'uuid', nullable: true })
  chatId?: string; // Может быть chat.id или channel.id

  // Связь с сообщением (если прикреплено к сообщению)
  @ManyToOne(() => MessageMetadata, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'messageId' })
  message?: MessageMetadata;

  @Column({ type: 'uuid', nullable: true })
  messageId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;

  // Время последнего доступа (для очистки неиспользуемых файлов)
  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedAt?: Date;

  // Метаданные файла
  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    // Для изображений
    format?: string;
    colorDepth?: number;
    dpi?: number;
    orientation?: number;

    // Для аудио/видео
    codec?: string;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    fps?: number;

    // Для документов
    pageCount?: number;
    author?: string;
    title?: string;

    // Системные
    encryption?: {
      algorithm?: string;
      keyId?: string;
      iv?: string;
    };
    compression?: {
      algorithm?: string;
      ratio?: number;
    };

    [key: string]: any;
  };

  // Статус обработки
  @Column({ type: 'varchar', length: 20, default: 'uploaded' })
  status!: 'uploading' | 'uploaded' | 'processing' | 'processed' | 'error' | 'deleted';

  @Column({ type: 'text', nullable: true })
  errorReason?: string;

  // Версии файла (разные размеры/качества)
  @Column({ type: 'jsonb', nullable: true })
  variants?: Array<{
    key: string; // S3 ключ
    size: number;
    width?: number;
    height?: number;
    quality?: number;
    mimeType: string;
    purpose: 'thumbnail' | 'preview' | 'download' | 'original';
  }>;
}
