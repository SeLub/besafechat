import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Handle } from '../handle/handle.entity';
import { RedisService } from '../../common/redis.service';
import { ChatMember } from '../chat/chat-member.entity';
import { Chat } from '../chat/chat.entity';
import { Identity } from '../identity/identity.entity';
import { MessagesGateway } from '../message/gateways/messages.gateway';
import { MessageMetadata } from '../message/message-metadata.entity';
import { ChatRoomService } from '../message/services/chat-room.service';
import { MessageMetadataService } from '../message/services/message-metadata.service';
import { SessionService } from '../session/services/session.service';
import { Session } from '../session/session.entity';
import { ContactRequest } from './contact-request.entity';
import { ContactRequestController } from './controllers/contact-request.controller';
import { ContactRequestService } from './services/contact-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContactRequest,
      Identity,
      Handle,
      Session,
      MessageMetadata,
      Chat,
      ChatMember,
    ]),
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
