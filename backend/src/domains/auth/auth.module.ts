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
import { PasswordRecoveryController } from './controllers/password-recovery.controller';
import { IdentityController } from '../identity/controllers/identity.controller';
import { ClaimedRecoveryPassword } from './entities/claimed-recovery-password.entity';
import { AuthService } from './services/auth.service';
import { ChallengeService } from './services/challenge.service';
import { PasswordRecoveryService } from './services/password-recovery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClaimedRecoveryPassword]), // Add the new entity
    IdentityModule,
    SessionModule,
    HandleModule,
    ProfileModule,
    MessageModule,
    MediaModule,
    RedisModule,
  ],
  providers: [
    AuthService,
    ChallengeService,
    PasswordRecoveryService, // Add the new service
  ],
  controllers: [
    AuthSessionController,
    PasswordRecoveryController, // Add the new controller
    IdentityController, // Account deletion endpoint
  ],
  exports: [
    AuthService,
    ChallengeService,
    PasswordRecoveryService, // Export the new service
  ],
})
export class AuthModule {}
