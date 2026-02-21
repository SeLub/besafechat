// /home/selub/Documents/progs/besafechat/backend/src/domains/media/media.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { SessionModule } from '../session/session.module';
import { HandleModule } from '../handle/handle.module';

@Module({
  imports: [forwardRef(() => SessionModule), forwardRef(() => HandleModule)],
  providers: [MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
