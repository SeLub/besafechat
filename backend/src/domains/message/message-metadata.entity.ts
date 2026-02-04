import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Chat } from '../chat/chat.entity';
import { User } from '../user/user.entity';

@Entity('message_metadata')
export class MessageMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Chat, (chat) => chat.messages, { onDelete: 'CASCADE' })
  chat!: Chat;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'RESTRICT' })
  sender!: User;

  // Тип: 'text', 'image', 'file'
  @Column({ type: 'text' })
  type!: string;

  // Для медиа — ссылка на объект в Tebi
  @Column({ type: 'text', nullable: true })
  mediaUrl!: string;

  // Размер медиа в байтах
  @Column({ type: 'bigint', nullable: true })
  mediaSize!: number;

  // MIME-тип медиа
  @Column({ type: 'text', nullable: true })
  mimeType!: string;

  // Зашифрованный ключ для получателя (в будущем — массив)
  @Column({ type: 'bytea', nullable: true })
  encryptedKey!: Buffer;

  // Время отправки (клиентское)
  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date; // время сохранения на сервере
}
