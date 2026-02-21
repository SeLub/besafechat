// /home/selub/Documents/progs/besafechat/backend/src/domains/identity/services/identity.service.ts
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import { Identity } from '../identity.entity';
import { Handle } from '../../handle/handle.entity';
import { Profile } from '../../profile/profile.entity';
import { Chat } from '../../chat/chat.entity';
// Импортируйте другие сущности, если нужно восстанавливать их напрямую (ContactRequest, Team и т.д.)

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

    // Создаем новую идентичность
    const identity = this.identityRepository.create({
      masterPublicKey: publicKeyBuffer,
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
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    return await this.identityRepository.findOne({
      where: { masterPublicKey: publicKey },
      // deletedAt: IsNull() применяется автоматически благодаря @DeleteDateColumn
    });
  }

  /**
   * Найти SOFT-DELETED identity по публичному ключу
   * Используется только для процесса восстановления
   */
  async findDeletedByPublicKey(publicKeyBase64: string) {
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    return await this.identityRepository.findOne({
      where: {
        masterPublicKey: publicKey,
        deletedAt: Not(IsNull()),
      },
      withDeleted: true, // Разрешаем поиск удаленных записей
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

      // 1. Восстанавливаем Identity
      await manager.restore(Identity, { id: identityId });
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

        // 4. Восстанавливаем Chats, где эти Handles являются участниками или владельцами
        // Примечание: адаптируйте условия под вашу реальную схему связи Chat <-> Handle
        // Обычно это поле handleId или participantIds
        await manager.restore(Chat, [
          { handleId: In(handleIds) },
          // Если есть many-to-many таблица участников, её тоже нужно восстановить
          // Например: await manager.restore(ChatParticipant, { handleId: In(handleIds) });
        ]);
        this.logger.log(`Restored Chats related to Handles`);
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
}

// Вспомогательный импорт для In, если не был импортирован выше
import { In } from 'typeorm';
