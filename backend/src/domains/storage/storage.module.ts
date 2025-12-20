// src/domains/storage/storage.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SeedBackupController } from './controllers/seed-backup.controller';
import { StorageController } from './controllers/storage.controller';
import { UserModule } from '../user/user.module';
import { UsernameModule } from '../username/username.module';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => UsernameModule)],
  controllers: [SeedBackupController, StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
