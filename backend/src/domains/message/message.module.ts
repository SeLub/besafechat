// src/domains/message/message.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesGateway } from './gateways/messages.gateway';
import { MessageMetadataService } from './services/message-metadata.service';
import { ChatRoomService } from './services/chat-room.service';
import { MessageMetadata } from './message-metadata.entity';
import { Chat } from '../chat/chat.entity';
import { ChatMember } from '../chat/chat-member.entity';
import { User } from '../user/user.entity';
import { Session } from '../user/session.entity';
import { SessionService } from '../user/services/session.service';
import { RedisService } from '../../common/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageMetadata, Chat, ChatMember, User, Session])],
  providers: [
    MessagesGateway,
    MessageMetadataService,
    ChatRoomService,
    SessionService,
    RedisService,
  ],
  exports: [ChatRoomService],
})
export class MessageModule {}
