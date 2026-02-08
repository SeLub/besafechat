// src/domains/message/services/message-metadata.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from '../../chat/chat.entity';
import { MessagePayloadDto } from '../dtos/message-payload.dto';
import { MessageMetadata } from '../message-metadata.entity';
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
    console.log(`💾 MessageMetadataService: Saving message from ${senderId} to ${recipientId}`);

    // 1. Найти или создать чат 1:1
    console.log(`💬 Finding or creating chat between ${senderId} and ${recipientId}`);
    const chat = await this.chatRoomService.findOrCreatePrivateChat(senderId, recipientId);
    console.log(`💬 Chat created/retrieved with ID: ${chat.id}`);

    // 2. Сохранить метаданные
    const metadata = this.messageMetadataRepository.create({
      senderHandleId: senderId,
      chatId: chat.id,
      type: payload.type,
      encryptedKey: Buffer.from(payload.encryptedKey, 'base64'),
      timestamp: new Date(payload.timestamp),
    });

    console.log(`💾 Saving metadata with chatId: ${chat.id}, senderHandleId: ${senderId}`);

    const savedMetadata = await this.messageMetadataRepository.save(metadata);
    console.log(`✅ Metadata saved successfully with ID: ${savedMetadata.id}`);

    // 3. Обновить lastMessageAt в чате
    await this.chatRepository.update(chat.id, { lastMessageAt: new Date() });

    return { chatId: chat.id, messageId: savedMetadata.id };
  }
}
