// src/domains/storage/storage.module.ts
import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SeedBackupController } from './controllers/seed-backup.controller';
import { UserModule } from '../user/user.module';
import { UsernameModule } from '../username/username.module';

@Module({
  imports: [UserModule, UsernameModule],
  controllers: [SeedBackupController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}