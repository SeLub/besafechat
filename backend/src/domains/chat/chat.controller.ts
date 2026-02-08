// /home/selub/Documents/progs/besafechat/backend/src/domains/chat/chat.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ChatRoomService } from '../message/services/chat-room.service';
import { CurrentUser } from '../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../session/guards/jwt-session.guard';
import { MediaService } from '../media/media.service';
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
    private chatRoomService: ChatRoomService,
    private mediaService: MediaService
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
      relations: ['memberHandle', 'memberHandle.profile'],
    });

    // Формируем ответ с участниками
    return {
      ...chat,
      members: await Promise.all(
        members.map(async (member) => {
          const avatarUrl = member.memberHandleId
            ? await this.mediaService.getAvatarUrlIfExists(member.memberHandleId)
            : null;

          return {
            handleId: member.memberHandleId,
            role: member.role,
            canSendMessages: member.canSendMessages,
            joinedAt: member.joinedAt,
            user: {
              id: member.memberHandle?.ownerIdentityId,
              displayName: member.memberHandle?.profile?.displayName,
              firstName: member.memberHandle?.profile?.firstName || null,
              lastName: member.memberHandle?.profile?.lastName || null,
              handle: member.memberHandle?.value,
              alias: member.memberHandle?.alias || null,
              bio: member.memberHandle?.profile?.bio || null,
              avatarUrl,
            },
          };
        })
      ),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all chats for current user' })
  @ApiResponse({ status: 200, description: 'Chats retrieved successfully' })
  async getAllChats(@CurrentUser() user: any) {
    // Find all chat memberships for the user's handle
    const chatMemberships = await this.chatMemberRepository.find({
      where: { memberHandleId: user.handleId },
      relations: ['chat', 'memberHandle', 'memberHandle.profile'],
    });

    // For each chat, find the other member(s) (not the current user)
    const chats = await Promise.all(
      chatMemberships.map(async (membership) => {
        const otherMembers = await this.chatMemberRepository.find({
          where: {
            chatId: membership.chatId,
            memberHandleId: Not(user.handleId), // Exclude current user
          },
          relations: ['memberHandle', 'memberHandle.profile', 'memberHandle.ownerIdentity'],
        });

        return {
          id: membership.chatId,
          type: membership.chat.type,
          createdAt: membership.chat.createdAt,
          lastMessageAt: membership.chat.lastMessageAt,
          otherMembers: await Promise.all(
            otherMembers.map(async (member) => {
              const avatarUrl = member.memberHandleId
                ? await this.mediaService.getAvatarUrlIfExists(member.memberHandleId)
                : null;

              return {
                handleId: member.memberHandleId,
                user: {
                  id: member.memberHandle?.ownerIdentityId,
                  displayName: member.memberHandle?.profile?.displayName,
                  firstName: member.memberHandle?.profile?.firstName || null,
                  lastName: member.memberHandle?.profile?.lastName || null,
                  handle: member.memberHandle?.value,
                  alias: member.memberHandle?.alias || null,
                  bio: member.memberHandle?.profile?.bio || null,
                  avatarUrl,
                  publicKey: member.memberHandle?.ownerIdentity?.masterPublicKey?.toString('base64'),
                },
              };
            })
          ),
        };
      })
    );

    return { chats };
  }

  @Post('find-or-create')
  @ApiOperation({ summary: 'Find or create a private chat with another user' })
  @ApiBody({
    schema: {
      properties: {
        otherHandleId: {
          type: 'string',
          example: 'def456-ghi789-jkl012',
          description: 'The handle ID of the other user to create chat with',
        },
      },
    },
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
