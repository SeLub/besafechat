// /home/selub/Documents/progs/besafechat/backend/src/domains/session/session.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './session.entity';
import { SessionService } from './services/session.service';
import { HandleModule } from '../handle/handle.module';
@Module({
  imports: [TypeOrmModule.forFeature([Session]), HandleModule],
  providers: [SessionService],
  exports: [TypeOrmModule, SessionService],
})
export class SessionModule {}
