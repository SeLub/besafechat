// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/profile.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './profile.entity';
import { ProfileService } from './services/profile.service';
import { ProfileController } from './controllers/profile.controller';
import { HandleModule } from '../handle/handle.module';
import { SessionModule } from '../session/session.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile]),
    forwardRef(() => HandleModule), // Используем forwardRef для избежания circular dependency
    forwardRef(() => SessionModule),
    MediaModule,
  ],
 providers: [ProfileService],
  controllers: [ProfileController],
  exports: [ProfileService, TypeOrmModule],
})
export class ProfileModule {}
