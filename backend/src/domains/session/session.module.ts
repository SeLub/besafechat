// /home/selub/Documents/progs/besafechat/backend/src/domains/session/session.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HandleModule } from '../handle/handle.module';
import { SessionService } from './services/session.service';
import { Session } from './session.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Session]), forwardRef(() => HandleModule)],
  providers: [SessionService],
  exports: [TypeOrmModule, SessionService],
})
export class SessionModule {}
