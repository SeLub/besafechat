// /home/selub/Documents/progs/besafechat/backend/src/domains/session/guards/jwt-session.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionService } from '../services/session.service';
import { HandleService } from '../../handle/services/handle.service';

interface RequestWithUser {
  user?: {
    identityId: string;
    handleId?: string;
    sessionId: string;
    publicKey?: Buffer;
  };
  identity?: any;
  handle?: any;
  session?: any;
  cookies?: {
    [key: string]: string;
  };
}

@Injectable()
export class JwtSessionGuard implements CanActivate {
  constructor(
    private sessionService: SessionService,
    private handleService: HandleService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // 1. Получаем access_token из куки
    const accessToken = request.cookies?.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('Access token missing');
    }

    // 2. Валидируем токен через сессию
    const session = await this.sessionService.validateAccessToken(accessToken);
    if (!session || session.revoked) {
      throw new UnauthorizedException('Invalid or revoked access token');
    }

    // 3. Проверяем, не истёк ли срок действия
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Access token expired');
    }

    // 4. Получаем активный Handle (из сессии или находим primary)
    let activeHandle = session.activeHandle;
    if (!activeHandle) {
      const primaryHandle = await this.handleService.getPrimaryHandle(session.identityId);
      if (primaryHandle) {
        // Обновляем сессию с активным Handle
        session.activeHandleId = primaryHandle.id;
        session.activeHandle = primaryHandle;
        session.lastActiveAt = new Date();
        await this.sessionService.saveSession(session); // Используем существующий метод save
        activeHandle = primaryHandle;
      }
    }

    // 5. Присоединяем данные к запросу
    request.user = {
      identityId: session.identity.id,
      handleId: activeHandle?.id,
      sessionId: session.id,
      publicKey: session.identity.masterPublicKey,
    };

    // 6. Дополнительные объекты для удобства
    request.identity = session.identity;
    request.handle = activeHandle;
    request.session = session;

    return true;
  }
}
