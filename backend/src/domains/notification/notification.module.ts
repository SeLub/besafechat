import { Module } from '@nestjs/common';
import { HandleModule } from '../handle/handle.module';
import { RedisService } from '../redis/redis.service';
import { SessionModule } from '../session/session.module';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';

@Module({
  imports: [SessionModule, HandleModule],
  providers: [NotificationService, RedisService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
