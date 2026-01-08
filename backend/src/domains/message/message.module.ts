// src/domains/message/message.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../../common/redis.service';
import { ChatMember } from '../chat/chat-member.entity';
import { Chat } from '../chat/chat.entity';
import { Identity } from '../identity/identity.entity';
import { SessionService } from '../session/services/session.service';
import { Session } from '../session/session.entity';
import { MessagesGateway } from './gateways/messages.gateway';
import { MessageMetadata } from './message-metadata.entity';
import { ChatRoomService } from './services/chat-room.service';
import { MessageMetadataService } from './services/message-metadata.service';

@Module({
  imports: [TypeOrmModule.forFeature([MessageMetadata, Chat, ChatMember, Identity, Session])],
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
