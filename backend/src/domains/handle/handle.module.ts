// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/handle.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Handle } from './handle.entity';
import { Identity } from '../identity/identity.entity';
import { HandleService } from './services/handle.service';
import { HandleController } from './controllers/handle.controller';
import { ProfileModule } from '../profile/profile.module';
import { SessionModule } from '../session/session.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Handle, Identity]),
    forwardRef(() => ProfileModule),
    forwardRef(() => SessionModule),
    forwardRef(() => MediaModule),
  ],
  controllers: [HandleController],
  providers: [HandleService],
  exports: [HandleService, TypeOrmModule],
})
export class HandleModule {}
