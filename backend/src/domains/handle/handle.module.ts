import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { SessionModule } from '../session/session.module';
import { Identity } from '../identity/identity.entity';
import { HandleController } from './controllers/handle.controller';
import { Handle } from './handle.entity';
import { HandleService } from './services/handle.service';

@Module({
  imports: [TypeOrmModule.forFeature([Handle, Identity]), IdentityModule, SessionModule],
  providers: [HandleService],
  controllers: [HandleController],
  exports: [TypeOrmModule, HandleService],
})
export class HandleModule {}
