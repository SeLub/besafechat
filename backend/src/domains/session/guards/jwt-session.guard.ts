// /home/selub/Documents/progs/besafechat/backend/src/domains/session/guards/jwt-session.guard.ts

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// Remove direct Express import for future Fastify compatibility
import { SessionService } from '../services/session.service';

// Define interface for request with user property
interface RequestWithUser {
  user?: {
    id: string;
    sessionId: string;
    publicKey: Buffer;
  };
  cookies?: {
    [key: string]: string;
  };
}

@Injectable()
export class JwtSessionGuard implements CanActivate {
  constructor(private sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // 1. Получаем access_token из куки
    const accessToken = request.cookies?.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('Access token missing');
    }

    // 2. Валидируем токен
    const session = await this.sessionService.validateAccessToken(accessToken);
    if (!session || session.revoked) {
      throw new UnauthorizedException('Invalid or revoked access token');
    }

    // 3. Проверяем, не истёк ли срок действия
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Access token expired');
    }

    // 4. Присоединяем пользователя и sessionId к запросу
    (request as RequestWithUser).user = {
      id: session.identity.id,
      sessionId: session.id,
      publicKey: session.identity.masterPublicKey!,
    };

    return true;
  }
}
