// /home/selub/Documents/progs/besafechat/backend/src/domains/contact/contact.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../../common/redis.service';
import { ChatMember } from '../chat/chat-member.entity';
import { Chat } from '../chat/chat.entity';
import { Handle } from '../handle/handle.entity';
import { Identity } from '../identity/identity.entity';
import { MessagesGateway } from '../message/gateways/messages.gateway';
import { MessageMetadata } from '../message/message-metadata.entity';
import { ChatRoomService } from '../message/services/chat-room.service';
import { MessageMetadataService } from '../message/services/message-metadata.service';
import { SessionModule } from '../session/session.module';
import { HandleModule } from '../handle/handle.module';
import { ContactRequest } from './contact-request.entity';
import { ContactRequestController } from './controllers/contact-request.controller';
import { ContactRequestService } from './services/contact-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactRequest, Identity, Handle, MessageMetadata, Chat, ChatMember]),
    SessionModule,
    HandleModule,
  ],
  providers: [
    ContactRequestService,
    MessagesGateway,
    MessageMetadataService,
    ChatRoomService,
    RedisService,
  ],
  controllers: [ContactRequestController],
  exports: [ContactRequestService],
})
export class ContactModule {}
