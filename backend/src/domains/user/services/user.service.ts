import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async registerUser(publicKeyBase64: string, displayName?: string) {
    // Декодируем base64 → Buffer
    let publicKeyBuffer: Buffer;
    try {
      publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
      if (publicKeyBuffer.length !== 32) {
        throw new Error('Invalid public key length');
      }
    } catch {
      throw new ConflictException('Invalid public key format');
    }

    // Проверяем уникальность
    const existingUser = await this.userRepository.findOne({
      where: { publicKey: publicKeyBuffer },
    });

    if (existingUser) {
      return existingUser;
    }

    // Создаём нового → явно указываем тип и избегаем null
    const user = new User();
    user.publicKey = publicKeyBuffer;
    user.displayName = displayName?.trim() || undefined; // ← null → undefined

    return await this.userRepository.save(user);
  }

  async findByPublicKey(publicKeyBase64: string) {
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    return await this.userRepository.findOne({
      where: { publicKey },
      relations: ['username'],
    });
  }

  async getProfileByUserId(userId: string) {
    return this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'publicKey', 'displayName'],
      relations: ['username'],
    });
  }

  async getUserPublicKeyBase64(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['publicKey'],
    });

    return user?.publicKey?.toString('base64') || null;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<void> {
    await this.userRepository.update({ id: userId }, { displayName: displayName.trim() });
  }
}
