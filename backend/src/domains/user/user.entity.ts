import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, OneToOne } from 'typeorm';
import { Session } from './session.entity';
import { ChatMember } from '../chat/chat-member.entity';
import { Username } from '../username/username.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Публичный ключ Ed25519 (основной идентификатор)
  @Column({ type: 'bytea', unique: true })
  publicKey!: Buffer;

  // Отображаемое имя (опционально)
  @Column({ type: 'text', nullable: true })
  displayName?: string;

  // Связь с опциональным именем пользователя
  @OneToOne(() => Username, (username) => username.user, { nullable: true })
  username?: Username;

  // Сессии (устройства)
  @OneToMany(() => Session, (session) => session.user)
  sessions!: Session[];

  // Участие в чатах
  @OneToMany(() => ChatMember, (member) => member.user)
  chatMemberships!: ChatMember[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
