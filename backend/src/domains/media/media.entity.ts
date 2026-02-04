import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Ключ в Tebi (например: "uploads/1701234567-image.jpg")
  @Column({ type: 'text', unique: true })
  storageKey!: string;

  @Column({ type: 'text' }) // MIME type
  mimeType!: string;

  @Column({ type: 'bigint' }) // Размер в байтах
  size!: number;

  // Кто загрузил
  @Column({ type: 'uuid' })
  uploaderId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;
}
