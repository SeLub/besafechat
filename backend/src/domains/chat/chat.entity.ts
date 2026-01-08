// /home/selub/Documents/progs/besafechat/backend/src/domains/chat/chat.entity.ts

// Примечания:

//     В приватных чатах 1:1 всегда будет ровно 2 участника

//     Chat не имеет Handle (нельзя найти через поиск)

//     Chat создается автоматически при принятии ContactRequest

//     Для каналов (channels) и команд (teams) будут отдельные сущности

// Особенности для E2EE Signal Protocol:

//     sharedSecret - для установления сеанса сквозного шифрования

//     preKeyBundle - предварительные ключи, необходимые для протокола Signal

//     sessionData - хранение цепочек ключей и ключей сообщений для дешифрования

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'private',
  })
  type!: string; // Только 'private' (задел на будущее - 'group')

  // Для E2EE по протоколу Signal
  @Column({ type: 'bytea', nullable: true })
  sharedSecret?: Buffer; // Общий секрет для установления сессии

  @Column({ type: 'bytea', nullable: true })
  preKeyBundle?: Buffer; // Предварительные ключи для Signal Protocol

  @Column({ type: 'jsonb', nullable: true })
  sessionData?: {
    // Данные сессии E2EE
    senderChainKey?: Buffer;
    receiverChainKey?: Buffer;
    messageKeys?: Array<{ index: number; key: Buffer }>;
  };

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
