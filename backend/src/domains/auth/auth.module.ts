import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityModule } from '../identity/identity.module';
import { SessionModule } from '../session/session.module';
import { AuthSessionController } from './controllers/auth-session.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // Add any auth-specific entities here if needed
    IdentityModule,
    SessionModule,
  ],
  providers: [AuthService],
  controllers: [AuthSessionController],
  exports: [AuthService],
})
export class AuthModule {}
