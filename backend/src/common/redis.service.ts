import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', '127.0.0.1'),
      port: parseInt(this.configService.get('REDIS_PORT', '6380'), 10),
      password: this.configService.get('REDIS_PASSWORD', 'redis_secure'),
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.error('Redis: Max retry attempts reached');
          return null; // прекратить попытки
        }
        return Math.min(times * 50, 2000); // эксп. отступ
      },
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
