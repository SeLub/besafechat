// /home/selub/Documents/progs/besafechat/backend/src/domains/identity/services/identity.service.ts
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not, In } from 'typeorm';
import * as crypto from 'crypto';
import { Identity } from '../identity.entity';
import { Handle } from '../../handle/handle.entity';
import { Profile } from '../../profile/profile.entity';
import { Chat } from '../../chat/chat.entity';
import { MessageMetadata } from '../../message/message-metadata.entity';
import { ChannelMessage } from '../../channel/channel-message.entity';
import { ChatMember } from '../../chat/chat-member.entity';
import { ContactRequest } from '../../contact/contact-request.entity';
import { TeamMembership } from '../../team/team-membership.entity';
import { TeamInvite } from '../../team/team-invite.entity';
import { ChannelSubscriber } from '../../channel/channel-subscriber.entity';
import { Channel } from '../../channel/channel.entity';
import { Team } from '../../team/team.entity';
import { Media } from '../../media/media.entity';
import { Session } from '../../session/session.entity';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    @InjectRepository(Handle)
    private handleRepository: Repository<Handle>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @InjectRepository(Chat)
    private chatRepository: Repository<Chat>,
    private dataSource: DataSource
  ) {}

  /**
   * Хеширует публичный ключ для быстрого поиска
   * SHA256(base64_key) → hex string (64 chars)
   */
  private hashPublicKey(publicKeyBase64: string): string {
    return crypto.createHash('sha256').update(publicKeyBase64).digest('hex');
  }

  async registerIdentity(publicKeyBase64: string): Promise<Identity> {
    let publicKeyBuffer: Buffer;
    try {
      publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
      if (publicKeyBuffer.length !== 32) {
        throw new Error('Invalid public key length');
      }
    } catch {
      throw new ConflictException('Invalid public key format');
    }

    // Проверяем только АКТИВНЫЕ идентичности при регистрации
    const existingIdentity = await this.findByIdentityPublicKey(publicKeyBase64);

    if (existingIdentity) {
      return existingIdentity;
    }

    // Создаем новую идентичность с хешем для быстрого поиска
    const publicKeyHash = this.hashPublicKey(publicKeyBase64);
    const identity = this.identityRepository.create({
      masterPublicKey: publicKeyBuffer,
      publicKeyHash,
    });
    return await this.identityRepository.save(identity);
  }

  async findByIdentityId(identityId: string) {
    // По умолчанию TypeORM исключает soft-deleted записи
    return await this.identityRepository.findOne({
      where: { id: identityId },
    });
  }

  /**
   * Найти АКТИВНУЮ identity по публичному ключу
   */
  async findByIdentityPublicKey(publicKeyBase64: string) {
    const publicKeyHash = this.hashPublicKey(publicKeyBase64);
    return await this.identityRepository.findOne({
      where: { publicKeyHash },
    });
  }

  /**
   * Найти SOFT-DELETED identity по публичному ключу
   * Используется только для процесса восстановления
   */
  async findDeletedByPublicKey(publicKeyBase64: string) {
    const publicKeyHash = this.hashPublicKey(publicKeyBase64);
    return await this.identityRepository.findOne({
      where: {
        publicKeyHash,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true,
    });
  }

  /**
   * Восстановить Identity и все связанные сущности (Handles, Profiles, Chats)
   * Выполняется в транзакции
   */
  async recoverIdentity(identityId: string): Promise<Identity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // 1. Восстанавливаем Identity и устанавливаем recoveredAt
      await manager.restore(Identity, { id: identityId });
      await manager.update(Identity, { id: identityId }, { recoveredAt: new Date() });
      this.logger.log(`Restored Identity: ${identityId}`);

      // 2. Восстанавливаем все Handles этой Identity
      await manager.restore(Handle, { ownerIdentityId: identityId });
      this.logger.log(`Restored Handles for Identity: ${identityId}`);

      // 3. Восстанавливаем Profiles, связанные с этими Handles
      // Сначала получаем ID восстановленных хендлов
      const handles = await manager.find(Handle, {
        where: { ownerIdentityId: identityId },
        withDeleted: true,
        select: ['id'],
      });

      const handleIds = handles.map((h) => h.id);
      if (handleIds.length > 0) {
        await manager.restore(Profile, { handleId: In(handleIds) });
        this.logger.log(`Restored Profiles for Handles: ${handleIds.length}`);

        // 4. Восстанавливаем Chats, где эти Handles являются участниками
        // Примечание: Chat может быть связан через chat_members таблицу
        // Но так как chat_members hard-deleted, восстанавливаем только через handleId если есть такая связь
        // В текущей схеме Chat не имеет прямой связи с Handle, поэтому пропускаем
        this.logger.log(`Skipped Chat restoration (no direct Handle association)`);
      }

      // TODO: Добавить восстановление других сущностей при необходимости:
      // - ContactRequest
      // - Team (если пользователь владелец)
      // - MessageMetadata (обычно привязаны к чату, который уже восстановлен)

      await queryRunner.commitTransaction();

      // Возвращаем "чистую" сущность (без флага deleted)
      const restoredIdentity = await this.identityRepository.findOne({
        where: { id: identityId },
      });

      if (!restoredIdentity) {
        throw new Error('Identity not found after recovery');
      }

      return restoredIdentity;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to recover identity ${identityId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft delete identity with full cascade (start 90-day recovery window)
   * Explicitly soft-deletes all related entities to maintain data consistency
   * Note: Database CASCADE rules work for hard delete; for soft delete we handle it in code
   */
  async softDeleteIdentity(identityId: string): Promise<{ recoveryDeadline: Date }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`[Soft Delete] Starting cascade soft-delete for identity: ${identityId}`);

      const now = new Date();
      const recoveryDeadline = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

      // First, verify identity exists
      const identity = await queryRunner.manager.findOne(Identity, {
        where: { id: identityId },
      });

      if (!identity) {
        throw new Error(`Identity ${identityId} not found`);
      }

      if (identity.deletedAt) {
        throw new Error(`Identity ${identityId} is already marked for deletion`);
      }

      // Get all Handles owned by this Identity
      const handles = await queryRunner.manager.find(Handle, {
        where: { ownerIdentityId: identityId },
        select: ['id'],
      });

      const handleIds = handles.map((h) => h.id);
      this.logger.log(
        `[Soft Delete] Found ${handleIds.length} handle(s) for identity ${identityId}`
      );

      if (handleIds.length > 0) {
        // Phase 1: Mark messages as deleted
        // Update MessageMetadata (soft delete with flag)
        const msgDeleteResult = await queryRunner.manager.update(
          MessageMetadata,
          { senderHandleId: In(handleIds) },
          { deletedAt: now, isDeleted: true }
        );
        this.logger.log(
          `[Soft Delete] Marked ${msgDeleteResult.affected} message metadata records as deleted`
        );

        // Update ChannelMessage (only has isDeleted flag, no deletedAt)
        const chanMsgResult = await queryRunner.manager.update(
          ChannelMessage,
          { senderHandleId: In(handleIds) },
          { isDeleted: true }
        );
        this.logger.log(
          `[Soft Delete] Marked ${chanMsgResult.affected} channel message records as deleted`
        );

        // Phase 2: Delete group memberships & requests (hard delete, no soft delete support)
        const chatMemberResult = await queryRunner.manager.delete(ChatMember, {
          memberHandleId: In(handleIds),
        });
        this.logger.log(`[Soft Delete] Deleted ${chatMemberResult.affected} chat member records`);

        // Delete contact requests (both sent and received)
        const contactReqSentResult = await queryRunner.manager.delete(ContactRequest, {
          fromHandleId: In(handleIds),
        });
        const contactReqRecResult = await queryRunner.manager.delete(ContactRequest, {
          toHandleId: In(handleIds),
        });
        this.logger.log(
          `[Soft Delete] Deleted ${(contactReqSentResult.affected || 0) + (contactReqRecResult.affected || 0)} contact request records`
        );

        // Delete team memberships
        const teamMemberResult = await queryRunner.manager.delete(TeamMembership, {
          memberHandleId: In(handleIds),
        });
        this.logger.log(
          `[Soft Delete] Deleted ${teamMemberResult.affected} team membership records`
        );

        // Delete team invites (both sent and received)
        const teamInviteSentResult = await queryRunner.manager.delete(TeamInvite, {
          inviterHandleId: In(handleIds),
        });
        const teamInviteRecResult = await queryRunner.manager.delete(TeamInvite, {
          invitedHandleId: In(handleIds),
        });
        this.logger.log(
          `[Soft Delete] Deleted ${(teamInviteSentResult.affected || 0) + (teamInviteRecResult.affected || 0)} team invite records`
        );

        // Delete channel subscriptions
        const chanSubResult = await queryRunner.manager.delete(ChannelSubscriber, {
          subscriberHandleId: In(handleIds),
        });
        this.logger.log(
          `[Soft Delete] Deleted ${chanSubResult.affected} channel subscriber records`
        );

        // Phase 3: Soft delete Profiles (1:1 with Handle)
        const profileResult = await queryRunner.manager.update(
          Profile,
          { handleId: In(handleIds) },
          { deletedAt: now }
        );
        this.logger.log(`[Soft Delete] Soft-deleted ${profileResult.affected} profile records`);

        // Phase 4: Soft delete Handles
        const handleResult = await queryRunner.manager.update(
          Handle,
          { id: In(handleIds) },
          { deletedAt: now }
        );
        this.logger.log(`[Soft Delete] Soft-deleted ${handleResult.affected} handle records`);
      }

      // Phase 5: Soft delete owned Channels
      const channelResult = await queryRunner.manager.update(
        Channel,
        { ownerIdentityId: identityId },
        { deletedAt: now }
      );
      this.logger.log(`[Soft Delete] Soft-deleted ${channelResult.affected} channel records`);

      // Phase 5: Soft delete owned Teams
      const teamResult = await queryRunner.manager.update(
        Team,
        { ownerIdentityId: identityId },
        { deletedAt: now }
      );
      this.logger.log(`[Soft Delete] Soft-deleted ${teamResult.affected} team records`);

      // Phase 5: Soft delete Media uploaded by this Identity
      const mediaResult = await queryRunner.manager.update(
        Media,
        { uploaderIdentityId: identityId },
        { deletedAt: now }
      );
      this.logger.log(`[Soft Delete] Soft-deleted ${mediaResult.affected} media records`);

      // Phase 6: Revoke all Sessions for this Identity
      const sessionResult = await queryRunner.manager.update(
        Session,
        { identityId },
        { revoked: true, isActive: false }
      );
      this.logger.log(`[Soft Delete] Revoked ${sessionResult.affected} session records`);

      // Phase 7: Soft delete Identity itself
      const identityResult = await queryRunner.manager.softDelete(Identity, {
        id: identityId,
      });

      if (identityResult.affected === 0) {
        throw new Error(`Failed to soft delete identity ${identityId}`);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `[Soft Delete] Successfully completed cascade soft-delete for identity ${identityId}`
      );

      return { recoveryDeadline };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `[Soft Delete] Failed to soft-delete identity ${identityId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
