import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './chat.entity';
import { ChatMember } from './chat-member.entity';
import { ChatController } from './chat.controller';
import { UserModule } from '../user/user.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, ChatMember]), UserModule, MessageModule],
  controllers: [ChatController],
  exports: [TypeOrmModule],
})
export class ChatModule {}
