import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Identity } from './identity.entity';
import { IdentityService } from './services/identity.service';

@Module({
  imports: [TypeOrmModule.forFeature([Identity])],
  providers: [IdentityService],
  exports: [TypeOrmModule, IdentityService],
})
export class IdentityModule {}
