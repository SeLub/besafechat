import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { ChatMember } from './chat-member.entity';
import { JwtSessionGuard } from '../user/guards/jwt-session.guard';
import { CurrentUser } from '../user/decorators/current-user.decorator';
import { ChatRoomService } from '../message/services/chat-room.service';

@Controller('chats')
@UseGuards(JwtSessionGuard)
export class ChatController {
  constructor(
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    @InjectRepository(ChatMember)
    private chatMemberRepository: Repository<ChatMember>,
    private chatRoomService: ChatRoomService
  ) {}

  @Get(':id')
  async getChatById(@Param('id') chatId: string, @CurrentUser() user: any) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members', 'members.user', 'members.user.username'],
    });

    if (!chat) {
      return { error: 'Chat not found' };
    }

    // Check if user is member of this chat
    const isMember = chat.members.some((member) => member.userId === user.id);
    if (!isMember) {
      return { error: 'Access denied' };
    }

    return chat;
  }

  @Post('find-or-create')
  async findOrCreateChat(@Body() body: { otherUserId: string }, @CurrentUser() user: any) {
    const chat = await this.chatRoomService.findOrCreatePrivateChat(user.id, body.otherUserId);
    return { chatId: chat.id };
  }
}
