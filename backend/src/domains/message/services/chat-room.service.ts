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

  async findOrCreatePrivateChat(senderId: string, recipientId: string) {
    if (!senderId || !recipientId) {
      console.log('senderId :', senderId, 'recipientId :', recipientId);
      throw new Error('Both senderId and recipientId are required');
    }

    const [first, second] = [senderId, recipientId].sort();

    // Поиск существующего чата
    const chat = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.members', 'member1', 'member1.userId = :first', { first })
      .innerJoin('chat.members', 'member2', 'member2.userId = :second', { second })
      .where('chat.type = :type', { type: 'private' })
      .getOne();

    if (chat) return chat;

    // Создание нового чата
    const newChat = this.chatRepository.create({ type: 'private' });
    await this.chatRepository.save(newChat);

    // ✅ Правильное добавление ОБОИХ участников
    await this.chatMemberRepository.save([
      { chatId: newChat.id, userId: first },
      { chatId: newChat.id, userId: second }, // ← recipientId, а не chatId!
    ]);

    return newChat;
  }
}
