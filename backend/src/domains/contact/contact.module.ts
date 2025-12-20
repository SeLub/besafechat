import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactRequest } from './contact-request.entity';
import { User } from '../user/user.entity';
import { ContactRequestService } from './services/contact-request.service';
import { ContactRequestController } from './controllers/contact-request.controller';
import { SessionService } from '../user/services/session.service';
import { Session } from '../user/session.entity';
import { MessagesGateway } from '../message/gateways/messages.gateway';
import { MessageMetadataService } from '../message/services/message-metadata.service';
import { ChatRoomService } from '../message/services/chat-room.service';
import { MessageMetadata } from '../message/message-metadata.entity';
import { Chat } from '../chat/chat.entity';
import { ChatMember } from '../chat/chat-member.entity';
import { RedisService } from '../../common/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactRequest, User, Session, MessageMetadata, Chat, ChatMember]),
  ],
  providers: [
    ContactRequestService,
    SessionService,
    MessagesGateway,
    MessageMetadataService,
    ChatRoomService,
    RedisService,
  ],
  controllers: [ContactRequestController],
  exports: [ContactRequestService],
})
export class ContactModule {}
