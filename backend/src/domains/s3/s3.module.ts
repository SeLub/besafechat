// src/domains/s3/s3.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { S3Service } from './s3.service';
import { S3Controller } from './controllers/s3.controller';
import { UserModule } from '../user/user.module';
import { UsernameModule } from '../username/username.module';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => UsernameModule)],
  controllers: [S3Controller],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
