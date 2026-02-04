import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './domains/auth/auth.module';
import { HandleModule } from './domains/handle/handle.module';
import { IdentityModule } from './domains/identity/identity.module';
import { ProfileModule } from './domains/profile/profile.module';
import { TeamModule } from './domains/team/team.module';
import { SessionModule } from './domains/session/session.module';
import { MessageModule } from './domains/message/message.module';
import { ContactModule } from './domains/contact/contact.module';
import { ChatModule } from './domains/chat/chat.module';
import { S3Module } from './domains/s3/s3.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    HandleModule,
    IdentityModule,
    ProfileModule,
    TeamModule,
    SessionModule,
    MessageModule,
    ContactModule,
    ChatModule,
    S3Module,
  ],
})
export class AppModule {
  static configureCors(configService: ConfigService) {
    const origins = configService.get<string>('CORS_ORIGINS');
    return {
      origin: origins ? origins.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true,
    };
  }
}
