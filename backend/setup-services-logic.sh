#!/bin/bash

# =============== UserService ===============
cat > src/domains/user/services/user.service.ts << 'EOF'
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async registerUser(publicKeyBase64: string, displayName?: string) {
    // Декодируем base64 → Buffer
    let publicKeyBuffer: Buffer;
    try {
      publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
      if (publicKeyBuffer.length !== 32) {
        throw new Error('Invalid public key length');
      }
    } catch (error) {
      throw new ConflictException('Invalid public key format');
    }

    // Проверяем уникальность
    const existingUser = await this.userRepository.findOne({
      where: { publicKey: publicKeyBuffer },
    });

    if (existingUser) {
      // Возвращаем существующего пользователя (идемпотентность)
      return existingUser;
    }

    // Создаём нового
    const user = this.userRepository.create({
      publicKey: publicKeyBuffer,
      displayName: displayName?.trim() || null,
    });

    return await this.userRepository.save(user);
  }

  async findByPublicKey(publicKeyBase64: string) {
    const publicKey = Buffer.from(publicKeyBase64, 'base64');
    return await this.userRepository.findOne({
      where: { publicKey },
      relations: ['username'],
    });
  }
}
EOF

# =============== UsernameService ===============
cat > src/domains/username/services/username.service.ts << 'EOF'
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Username } from '../username.entity';
import { User } from '../../user/user.entity';

@Injectable()
export class UsernameService {
  constructor(
    @InjectRepository(Username)
    private usernameRepository: Repository<Username>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async setUsername(userId: string, username: string, isSearchable: boolean) {
    // Начинаем транзакцию (чтобы избежать гонки)
    return this.dataSource.transaction(async (manager) => {
      // Проверяем, не занято ли имя
      const existing = await manager.findOne(Username, {
        where: { username },
      });

      if (existing && existing.user.id !== userId) {
        throw new ConflictException('Username is already taken');
      }

      // Находим пользователя
      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: ['username'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Создаём или обновляем
      let userUsername = user.username;
      if (!userUsername) {
        userUsername = manager.create(Username);
        userUsername.user = user;
      }

      userUsername.username = username;
      userUsername.isSearchable = isSearchable;

      await manager.save(userUsername);
      return userUsername;
    });
  }

  async findUserByUsername(username: string) {
    const usernameRecord = await this.usernameRepository.findOne({
      where: { username, isSearchable: true },
      relations: ['user'],
    });

    if (!usernameRecord || !usernameRecord.isSearchable) {
      return null;
    }

    return {
      id: usernameRecord.user.id,
      publicKey: usernameRecord.user.publicKey.toString('base64'),
      displayName: usernameRecord.user.displayName,
    };
  }
}
EOF

echo "✅ Сервисы обновлены с реальной логикой!"
echo "🔑 Поддержка:"
echo "   - Регистрации по публичному ключу"
echo "   - Установки уникального @username"
echo "   - Поиска только по разрешённым именам"