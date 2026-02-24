// /home/selub/Documents/progs/besafechat/backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule'; // <-- Импорт
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './domains/auth/auth.module';
import { ChatModule } from './domains/chat/chat.module';
import { ContactModule } from './domains/contact/contact.module';
import { HandleModule } from './domains/handle/handle.module';
import { IdentityModule } from './domains/identity/identity.module';
import { MediaModule } from './domains/media/media.module';
import { MessageModule } from './domains/message/message.module';
import { NotificationModule } from './domains/notification/notification.module';
import { ProfileModule } from './domains/profile/profile.module';
import { SessionModule } from './domains/session/session.module';
import { TeamModule } from './domains/team/team.module';
import { RedisModule } from './domains/redis/redis.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(), // <-- Включение планировщика
    DatabaseModule,
    RedisModule,
    AuthModule,
    HandleModule,
    IdentityModule,
    ProfileModule,
    TeamModule,
    SessionModule,
    MessageModule,
    NotificationModule,
    ContactModule,
    ChatModule,
    MediaModule,
  ],
})
export class AppModule {}
