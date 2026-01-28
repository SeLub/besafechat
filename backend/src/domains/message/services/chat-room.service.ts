// src/domains/message/services/chat-room.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ChatMember } from '../../chat/chat-member.entity';
import { Chat } from '../../chat/chat.entity';

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
    console.log(
      `🔍 ChatRoomService: Looking for existing chat between ${userHandleId} and ${otherHandleId}`
    );

    // Находим общий чат через ChatMember
    const userChats = await this.chatMemberRepository.find({
      where: { memberHandleId: userHandleId },
      select: ['chatId'],
    });

    const otherChats = await this.chatMemberRepository.find({
      where: { memberHandleId: otherHandleId },
      select: ['chatId'],
    });

    console.log(
      `🔍 ChatRoomService: User ${userHandleId} has chats:`,
      userChats.map((c) => c.chatId)
    );
    console.log(
      `🔍 ChatRoomService: Other user ${otherHandleId} has chats:`,
      otherChats.map((c) => c.chatId)
    );

    const userChatIds = userChats.map((c) => c.chatId);
    const otherChatIds = otherChats.map((c) => c.chatId);

    const commonChatIds = userChatIds.filter((id) => otherChatIds.includes(id));
    console.log(`🔍 ChatRoomService: Common chat IDs:`, commonChatIds);

    if (commonChatIds.length > 0) {
      console.log(`🔍 ChatRoomService: Found existing chat: ${commonChatIds[0]}`);
      return this.chatRepository.findOne({
        where: { id: commonChatIds[0] },
      });
    }

    console.log(
      `🔍 ChatRoomService: No existing chat found between ${userHandleId} and ${otherHandleId}`
    );
    return null;
  }

  async getRelatedHandles(handleId: string): Promise<string[]> {
    console.log(`🔍 ChatRoomService: Finding related handles for: ${handleId}`);

    // Find all chats that the handle is a member of
    const chatMembers = await this.chatMemberRepository.find({
      where: { memberHandleId: handleId },
      select: ['chatId'],
    });

    console.log(`🔍 ChatRoomService: Found ${chatMembers.length} chats for handle ${handleId}`);

    const chatIds = chatMembers.map((cm) => cm.chatId);
    console.log(`🔍 ChatRoomService: Chat IDs:`, chatIds);

    if (chatIds.length === 0) {
      console.log(
        `🔍 ChatRoomService: No chats found for handle ${handleId}, returning empty array`
      );
      return [];
    }

    // Find all other handles that are members of these same chats
    const relatedMembers = await this.chatMemberRepository.find({
      where: {
        chatId: In(chatIds),
        memberHandleId: Not(handleId),
      },
      select: ['memberHandleId'],
    });

    console.log(
      `🔍 ChatRoomService: Found ${relatedMembers.length} related members for handle ${handleId}`
    );

    // Extract unique handle IDs
    const relatedHandleIds = [...new Set(relatedMembers.map((cm) => cm.memberHandleId))];
    console.log(`🔍 ChatRoomService: Related handle IDs:`, relatedHandleIds);

    return relatedHandleIds;
  }
}
