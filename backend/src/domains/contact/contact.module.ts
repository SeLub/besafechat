// /home/selub/Documents/progs/besafechat/backend/src/domains/contact/contact.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from '../../domains/redis/redis.service';
import { ChatMember } from '../chat/chat-member.entity';
import { Chat } from '../chat/chat.entity';
import { Handle } from '../handle/handle.entity';
import { HandleModule } from '../handle/handle.module';
import { MessagesGateway } from '../message/gateways/messages.gateway';
import { MessageMetadata } from '../message/message-metadata.entity';
import { ChatRoomService } from '../message/services/chat-room.service';
import { MessageMetadataService } from '../message/services/message-metadata.service';
import { MediaModule } from '../media/media.module';
import { NotificationModule } from '../notification/notification.module';
import { SessionModule } from '../session/session.module';
import { ContactRequest } from './contact-request.entity';
import { ContactRequestController } from './controllers/contact-request.controller';
import { ContactRequestService } from './services/contact-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContactRequest, Handle, MessageMetadata, Chat, ChatMember]),
    SessionModule,
    HandleModule,
    MediaModule,
    NotificationModule,
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
