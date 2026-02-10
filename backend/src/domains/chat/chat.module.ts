import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { MessageModule } from '../message/message.module';
import { SessionModule } from '../session/session.module';
import { HandleModule } from '../handle/handle.module';
import { MediaModule } from '../media/media.module';
import { ChatMember } from './chat-member.entity';
import { ChatController } from './chat.controller';
import { Chat } from './chat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chat, ChatMember]),
    IdentityModule,
    MessageModule,
    SessionModule,
    HandleModule,
    MediaModule,
  ],
  controllers: [ChatController],
  exports: [TypeOrmModule],
})
export class ChatModule {}
