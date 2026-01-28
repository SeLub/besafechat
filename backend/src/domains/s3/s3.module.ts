// src/domains/s3/s3.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { HandleModule } from '../handle/handle.module';
import { IdentityModule } from '../identity/identity.module';
import { SessionModule } from '../session/session.module';
import { S3Service } from './s3.service';

@Module({
  imports: [
    forwardRef(() => IdentityModule),
    forwardRef(() => HandleModule),
    forwardRef(() => SessionModule),
  ],
  controllers: [],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
