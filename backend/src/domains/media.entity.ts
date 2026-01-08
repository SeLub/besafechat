import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Identity } from './identity/identity.entity';

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Ключ в хранилище (например: "uploads/1701234567-image.jpg")
  @Column({ type: 'text', unique: true })
  storageKey!: string;

  // Оригинальное имя файла
  @Column({ type: 'text', nullable: true })
  originalFilename?: string;

  @Column({ type: 'text' }) // MIME type
  mimeType!: string;

  @Column({ type: 'bigint' }) // Размер в байтах
  size!: number;

  // Размеры для изображений/видео
  @Column({ type: 'int', nullable: true })
  width?: number;

  @Column({ type: 'int', nullable: true })
  height?: number;

  // Длительность для аудио/видео
  @Column({ type: 'float', nullable: true })
  duration?: number;

  // Хэш файла для дедупликации
  @Column({ type: 'text', nullable: true })
  fileHash?: string;

  // Кто загрузил
  @ManyToOne(() => Identity, { onDelete: 'SET NULL' })
  uploader?: Identity;

  @Column({ type: 'uuid', nullable: true })
  uploaderId!: string;

  // В каком чате было использовано (если известно)
  @Column({ type: 'uuid', nullable: true })
  chatId?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;

  // Дата последнего доступа (для cleanup старых файлов)
  @Column({ type: 'timestamptz', nullable: true })
  lastAccessedAt?: Date;

  // Ссылка на сообщение, если медиа в сообщении
  @Column({ type: 'uuid', nullable: true })
  messageId?: string;
}
