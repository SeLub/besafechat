// /home/selub/Documents/progs/besafechat/backend/src/domains/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { SessionModule } from '../session/session.module';
import { HandleModule } from '../handle/handle.module';
import { ProfileModule } from '../profile/profile.module';
import { MessageModule } from '../message/message.module';
import { AuthSessionController } from './controllers/auth-session.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]),
    IdentityModule,
    SessionModule,
    HandleModule,
    ProfileModule,
    MessageModule,
  ],
  providers: [AuthService],
  controllers: [AuthSessionController],
  exports: [AuthService],
})
export class AuthModule {}
