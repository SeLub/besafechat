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
    private dataSource: DataSource
  ) {}

  async setUsername(userId: string, username: string, isSearchable: boolean) {
    return this.dataSource.transaction(async (manager) => {
      // 1. Проверяем, не занято ли имя
      const existing = await manager.findOne(Username, {
        where: { username },
        relations: ['user'],
      });

      if (existing) {
        // If username belongs to different user, it's taken
        if (existing.user.id !== userId) {
          throw new ConflictException('Username is already taken');
        }
        // If it's the same user, just update the searchability
        existing.isSearchable = isSearchable;
        await manager.save(existing);
        return existing;
      }

      // 2. Находим пользователя
      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: ['username'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 3. Удаляем старую запись если есть
      if (user.username) {
        await manager.remove(user.username);
      }

      // 4. Создаём новую запись
      const userUsername = manager.create(Username, {
        username,
        isSearchable,
        user,
      });

      await manager.save(userUsername);
      return userUsername;
    });
  }

  async findUserByUsername(username: string) {
    // Use a more explicit query builder approach to avoid issues with nullable unique fields
    const usernameRecord = await this.usernameRepository
      .createQueryBuilder('username')
      .leftJoinAndSelect('username.user', 'user')
      .where('username.username = :username', { username })
      .andWhere('username.isSearchable = :isSearchable', { isSearchable: true })
      .getOne();

    if (!usernameRecord || !usernameRecord.user) {
      return null;
    }

    return {
      id: usernameRecord.user.id,
      publicKey: usernameRecord.user.publicKey.toString('base64'),
      displayName: usernameRecord.user.displayName,
    };
  }
}
