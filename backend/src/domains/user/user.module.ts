// src/domains/user/user.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Session } from './session.entity';
import { AuthController } from './controllers/auth.controller';
import { AuthSessionController } from './controllers/auth-session.controller';
import { OnlineStatusController } from './controllers/online-status.controller';
import { ProfileController } from './controllers/profile.controller';
import { UserService } from './services/user.service';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { RedisService } from '../../common/redis.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session]), forwardRef(() => StorageModule)],
  controllers: [AuthController, AuthSessionController, OnlineStatusController, ProfileController],
  providers: [UserService, AuthService, SessionService, RedisService],
  exports: [SessionService, UserService],
})
export class UserModule {}
