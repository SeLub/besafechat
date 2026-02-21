// /home/selub/Documents/progs/besafechat/backend/src/domains/identity/identity.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Identity } from './identity.entity';
import { IdentityService } from './services/identity.service';
import { IdentityCleanupService } from './services/identity-cleanup.service';

// Импортируем сущности, необходимые для каскадного удаления
import { Handle } from '../handle/handle.entity';
import { Profile } from '../profile/profile.entity';
import { Chat } from '../chat/chat.entity';
import { Channel } from '../channel/channel.entity';
import { ContactRequest } from '../contact/contact-request.entity';
import { Media } from '../media/media.entity';
import { MessageMetadata } from '../message/message-metadata.entity';
import { Team } from '../team/team.entity';

// Импортируем модули для доступа к сервисам (например, MediaService)
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    // Регистрируем все сущности, с которыми работает сервис
    TypeOrmModule.forFeature([
      Identity,
      Handle,
      Profile,
      Chat,
      Channel,
      ContactRequest,
      Media,
      MessageMetadata,
      Team,
    ]),
    // Импортируем MediaModule, чтобы внедрить MediaService
    forwardRef(() => MediaModule),
  ],
  providers: [IdentityService, IdentityCleanupService],
  exports: [TypeOrmModule, IdentityService],
})
export class IdentityModule {}
