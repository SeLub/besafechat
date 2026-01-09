// /home/selub/Documents/progs/besafechat/backend/src/domains/chat/chat.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoomService } from '../message/services/chat-room.service';
import { CurrentUser } from '../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../session/guards/jwt-session.guard';
import { ChatMember } from './chat-member.entity';
import { Chat } from './chat.entity';

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
  @ApiParam({
    name: 'id',
    description: 'Chat ID',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  @ApiOperation({ summary: 'Get chat by ID' })
  @ApiResponse({ status: 200, description: 'Chat retrieved successfully' })
  async getChatById(@Param('id') chatId: string, @CurrentUser() user: any) {
    // Получаем чат
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });

    if (!chat) {
      return { error: 'Chat not found' };
    }

    // Проверяем, является ли пользователь участником чата через ChatMember
    const membership = await this.chatMemberRepository.findOne({
      where: {
        chatId: chatId,
        memberHandleId: user.handleId, // Используем handleId из сессии
      },
    });

    if (!membership) {
      return { error: 'Access denied' };
    }

    // Получаем участников чата
    const members = await this.chatMemberRepository.find({
      where: { chatId: chatId },
      relations: ['memberHandle'],
    });

    // Формируем ответ с участниками
    return {
      ...chat,
      members: members.map((member) => ({
        handleId: member.memberHandleId,
        role: member.role,
        canSendMessages: member.canSendMessages,
        joinedAt: member.joinedAt,
        handle: {
          value: member.memberHandle?.value,
          alias: member.memberHandle?.alias,
        },
      })),
    };
  }

  @Post('find-or-create')
  @ApiOperation({ summary: 'Find or create a private chat with another user' })
  @ApiBody({
    schema: {
      properties: {
        otherHandleId: {
          type: 'string',
          example: 'def456-ghi789-jkl012',
          description: 'The handle ID of the other user to create chat with'
        }
      }
    }
  })
  async findOrCreateChat(@Body() body: { otherHandleId: string }, @CurrentUser() user: any) {
    // Используем handleId вместо identityId
    const chat = await this.chatRoomService.findOrCreatePrivateChat(
      user.handleId, // Handle текущего пользователя
      body.otherHandleId // Handle другого пользователя
    );
    return { chatId: chat.id };
  }
}
