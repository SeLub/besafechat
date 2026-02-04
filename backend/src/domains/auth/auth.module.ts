// /home/selub/Documents/progs/besafechat/backend/src/domains/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandleModule } from '../handle/handle.module';
import { IdentityModule } from '../identity/identity.module';
import { MediaModule } from '../media/media.module';
import { MessageModule } from '../message/message.module';
import { ProfileModule } from '../profile/profile.module';
import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../session/session.module';
import { AuthSessionController } from './controllers/auth-session.controller';
import { AuthService } from './services/auth.service';
import { ChallengeService } from './services/challenge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    IdentityModule,
    SessionModule,
    HandleModule,
    ProfileModule,
    MessageModule,
    MediaModule,
    RedisModule,
  ],
  providers: [AuthService, ChallengeService],
  controllers: [AuthSessionController],
  exports: [AuthService, ChallengeService],
})
export class AuthModule {}
