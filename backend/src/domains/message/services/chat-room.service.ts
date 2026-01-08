// src/domains/message/services/chat-room.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from '../../chat/chat.entity';
import { ChatMember } from '../../chat/chat-member.entity';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(ChatMember)
    private chatMemberRepository: Repository<ChatMember>
  ) {}

  // Обновленный метод в ChatRoomService
  async findOrCreatePrivateChat(userHandleId: string, otherHandleId: string): Promise<Chat> {
    // Проверяем существующий чат через ChatMember
    const existingChat = await this.findExistingPrivateChat(userHandleId, otherHandleId);

    if (existingChat) {
      return existingChat;
    }

    // Создаем новый чат
    const chat = this.chatRepository.create({
      type: 'private',
      // Добавляем поля для E2EE если нужно
    });

    await this.chatRepository.save(chat);

    // Создаем участников чата
    await Promise.all([
      this.chatMemberRepository.save({
        chatId: chat.id,
        memberHandleId: userHandleId,
        role: 'member',
        canSendMessages: true,
        joinedAt: new Date(),
      }),
      this.chatMemberRepository.save({
        chatId: chat.id,
        memberHandleId: otherHandleId,
        role: 'member',
        canSendMessages: true,
        joinedAt: new Date(),
      }),
    ]);

    return chat;
  }

  private async findExistingPrivateChat(
    userHandleId: string,
    otherHandleId: string
  ): Promise<Chat | null> {
    // Находим общий чат через ChatMember
    const userChats = await this.chatMemberRepository.find({
      where: { memberHandleId: userHandleId },
      select: ['chatId'],
    });

    const otherChats = await this.chatMemberRepository.find({
      where: { memberHandleId: otherHandleId },
      select: ['chatId'],
    });

    const userChatIds = userChats.map((c) => c.chatId);
    const otherChatIds = otherChats.map((c) => c.chatId);

    const commonChatIds = userChatIds.filter((id) => otherChatIds.includes(id));

    if (commonChatIds.length > 0) {
      return this.chatRepository.findOne({
        where: { id: commonChatIds[0] },
      });
    }

    return null;
  }
}
