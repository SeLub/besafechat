// /home/selub/Documents/progs/besafechat/backend/src/domains/identity/services/identity-cleanup.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, DataSource } from 'typeorm';
import { Identity } from '../identity.entity';
import { Handle } from '../../handle/handle.entity';
import { Profile } from '../../profile/profile.entity';
import { Chat } from '../../chat/chat.entity';
import { Channel } from '../../channel/channel.entity';
import { ContactRequest } from '../../contact/contact-request.entity';
import { Media } from '../../media/media.entity';
import { MessageMetadata } from '../../message/message-metadata.entity';
import { Team } from '../../team/team.entity';
import { MediaService } from '../../media/media.service'; // Сервис для удаления из S3

@Injectable()
export class IdentityCleanupService {
  private readonly logger = new Logger(IdentityCleanupService.name);
  private readonly RECOVERY_WINDOW_DAYS = 90;

  constructor(
    @InjectRepository(Identity)
    private identityRepo: Repository<Identity>,
    @InjectRepository(Handle)
    private handleRepo: Repository<Handle>,
    @InjectRepository(Profile)
    private profileRepo: Repository<Profile>,
    @InjectRepository(Chat)
    private chatRepo: Repository<Chat>,
    @InjectRepository(Channel)
    private channelRepo: Repository<Channel>,
    @InjectRepository(ContactRequest)
    private contactRequestRepo: Repository<ContactRequest>,
    @InjectRepository(Media)
    private mediaRepo: Repository<Media>,
    @InjectRepository(MessageMetadata)
    private messageRepo: Repository<MessageMetadata>,
    @InjectRepository(Team)
    private teamRepo: Repository<Team>,
    private mediaService: MediaService, // Для удаления файлов из S3
    private dataSource: DataSource
  ) {}

  /**
   * Запускается каждый день в 03:00 ночи
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleHardDelete() {
    this.logger.log('🗑️ [Cleanup] Starting hard delete job for expired soft-deleted accounts...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RECOVERY_WINDOW_DAYS);

    // 1. Находим все Identity, помеченные на удаление более 90 дней назад
    const expiredIdentities = await this.identityRepo.find({
      where: {
        deletedAt: LessThan(cutoffDate),
      },
      withDeleted: true,
      select: ['id', 'masterPublicKey'],
    });

    if (expiredIdentities.length === 0) {
      this.logger.log('🟢 [Cleanup] No expired accounts found.');
      return;
    }

    this.logger.warn(
      `🔴 [Cleanup] Found ${expiredIdentities.length} accounts to permanently delete.`
    );

    for (const identity of expiredIdentities) {
      await this.deleteIdentityCascade(identity.id).catch((err) => {
        this.logger.error(
          `❌ [Cleanup] Failed to delete identity ${identity.id}: ${err.message}`,
          err.stack
        );
      });
    }

    this.logger.log(`✅ [Cleanup] Finished processing ${expiredIdentities.length} accounts.`);
  }

  /**
   * Каскадное удаление для одной идентичности
   */
  private async deleteIdentityCascade(identityId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      this.logger.debug(`[Cleanup] Processing identity: ${identityId}`);

      // --- ШАГ 1: Удаление Медиа (S3 + БД) ---
      // Находим все медиа, загруженные этим пользователем
      const userMedia = await manager.find(Media, {
        where: { uploaderIdentityId: identityId },
        withDeleted: true,
        select: ['id', 'storageKey', 'variants'],
      });

      if (userMedia.length > 0) {
        this.logger.debug(`[Cleanup] Deleting ${userMedia.length} media files from S3...`);
        for (const media of userMedia) {
          try {
            // Удаляем основной файл и варианты из S3
            await this.mediaService.deleteFile(media.storageKey);

            // Если есть варианты (thumbnails и т.д.), удаляем их тоже
            if (media.variants) {
              for (const variant of media.variants) {
                if (variant.key && variant.key !== media.storageKey) {
                  await this.mediaService.deleteFile(variant.key);
                }
              }
            }
          } catch (s3Err) {
            const errorMessage = s3Err instanceof Error ? s3Err.message : 'Unknown error';
            this.logger.warn(
              `[Cleanup] Failed to delete S3 key ${media.storageKey}: ${errorMessage}. Continuing DB cleanup.`
            );
          }
        }
        // Физическое удаление записей о медиа из БД
        await manager.delete(Media, { uploaderIdentityId: identityId });
      }

      // --- ШАГ 2: Удаление сообщений (MessageMetadata) ---
      // Сообщения привязаны к Handle. Сначала найдем все хендлы пользователя.
      const userHandles = await manager.find(Handle, {
        where: { ownerIdentityId: identityId },
        withDeleted: true,
        select: ['id'],
      });
      const handleIds = userHandles.map((h) => h.id);

      if (handleIds.length > 0) {
        // Удаляем сообщения, отправленные этими хендлами
        // Примечание: Это может быть много записей. В продакшене лучше делать батчами.
        await manager.delete(MessageMetadata, { senderHandleId: In(handleIds) });
        this.logger.debug(`[Cleanup] Deleted messages for handles: ${handleIds.length}`);

        // Удаляем контактные запросы (от и кому)
        await manager.delete(ContactRequest, [
          { fromHandleId: In(handleIds) },
          { toHandleId: In(handleIds) },
        ]);
        this.logger.debug(`[Cleanup] Deleted contact requests`);
      }

      // --- ШАГ 3: Удаление Каналов ---
      // Каналы привязаны напрямую к Identity (ownerIdentityId) и имеют Handle
      // Сначала удалим сообщения каналов (если они есть в MessageMetadata по chatId=channel.id)
      // Для простоты полагаемся на то, что chatId в MessageMetadata может ссылаться на канал.
      // Но лучше сначала найти каналы и удалить их контент.

      const userChannels = await manager.find(Channel, {
        where: { ownerIdentityId: identityId },
        withDeleted: true,
        select: ['id'],
      });
      const channelIds = userChannels.map((c) => c.id);

      if (channelIds.length > 0) {
        // Удаляем сообщения внутри этих каналов
        await manager.delete(MessageMetadata, { chatId: In(channelIds) });
        // Теперь удаляем сами каналы (CASCADE удалит подписчиков и сообщения каналов через FK)
        await manager.delete(Channel, { ownerIdentityId: identityId });
        this.logger.debug(`[Cleanup] Deleted ${channelIds.length} channels and their content`);
      }

      // --- ШАГ 4: Удаление Команд (Teams) ---
      const userTeams = await manager.find(Team, {
        where: { ownerIdentityId: identityId },
        withDeleted: true,
        select: ['id'],
      });
      const teamIds = userTeams.map((t) => t.id);

      if (teamIds.length > 0) {
        // Удаляем команды (CASCADE должен убрать memberships, invites, child teams)
        await manager.delete(Team, { ownerIdentityId: identityId });
        this.logger.debug(`[Cleanup] Deleted ${teamIds.length} teams`);
      }

      // --- ШАГ 5: Удаление Чатов (Chat) ---
      // Чаты привязаны к Handle. Если хендлы удалены (или будут удалены), чаты можно чистить.
      // Но лучше явно удалить чаты, где пользователь был участником или владельцем.
      // Зависит от вашей схемы Chat. Предположим, что есть связь с Handle.
      if (handleIds.length > 0) {
        // Пример: удаляем чаты, где handleId совпадает
        // Вам可能需要 адаптировать условия под вашу схему Chat (participantIds и т.д.)
        await manager.delete(Chat, { handleId: In(handleIds) });
        // Если есть таблица участников чата (many-to-many), её очистят FK или нужно явно:
        // await manager.delete(ChatParticipant, { handleId: In(handleIds) });
      }

      // --- ШАГ 6: Удаление Профилей ---
      if (handleIds.length > 0) {
        await manager.delete(Profile, { handleId: In(handleIds) });
      }

      // --- ШАГ 7: Удаление Handles ---
      if (handleIds.length > 0) {
        await manager.delete(Handle, { ownerIdentityId: identityId });
      }

      // --- ШАГ 8: Физическое удаление Identity ---
      await manager.delete(Identity, { id: identityId });

      this.logger.log(`✅ [Cleanup] Successfully hard deleted identity: ${identityId}`);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
