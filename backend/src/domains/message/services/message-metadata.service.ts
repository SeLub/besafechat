// src/domains/message/services/message-metadata.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageMetadata } from '../message-metadata.entity';
import { MessagePayloadDto } from '../dtos/message-payload.dto';
import { User } from '../../user/user.entity';
import { Chat } from '../../chat/chat.entity';
import { ChatRoomService } from './chat-room.service';

@Injectable()
export class MessageMetadataService {
  constructor(
    @InjectRepository(MessageMetadata)
    private messageMetadataRepository: Repository<MessageMetadata>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    private chatRoomService: ChatRoomService
  ) {}

  async save(senderId: string, recipientId: string, payload: MessagePayloadDto) {
    // 1. Найти или создать чат 1:1
    const chat = await this.chatRoomService.findOrCreatePrivateChat(senderId, recipientId);

    // 2. Сохранить метаданные
    const metadata = this.messageMetadataRepository.create({
      sender: { id: senderId } as User,
      chat: { id: chat.id } as Chat,
      type: payload.type,
      encryptedKey: Buffer.from(payload.encryptedKey, 'base64'),
      timestamp: new Date(payload.timestamp),
    });

    await this.messageMetadataRepository.save(metadata);
    return chat.id;
  }
}
