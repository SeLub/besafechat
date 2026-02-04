// src/db/database.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5433),
        username: configService.get('DB_USERNAME', 'user'),
        password: configService.get('DB_PASSWORD', 'secure_password'),
        database: configService.get('DB_DATABASE', 'messenger'),
        // Explicitly specify entity paths to avoid loading compiled files
        entities: [__dirname + '/../domains/**/*.entity{.ts,.js}'],
        // Use migrations instead of synchronize for production
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production', // Only use sync in non-production
        logging: configService.get('NODE_ENV') === 'development', // Enable logging in development
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
