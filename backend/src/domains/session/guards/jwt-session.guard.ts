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
      console.log('[JWT Guard] No access token in cookies');
      throw new UnauthorizedException('Access token missing');
    }

    console.log('[JWT Guard] Validating access token');
    // 2. Валидируем токен через сессию
    const session = await this.sessionService.validateAccessToken(accessToken);
    if (!session || session.revoked) {
      console.log('[JWT Guard] Session invalid or revoked');
      throw new UnauthorizedException('Invalid or revoked access token');
    }

    console.log('[JWT Guard] Session found:', { id: session.id, activeHandleId: session.activeHandleId });

    // 3. Проверяем, не истёк ли срок действия
    if (session.expiresAt < new Date()) {
      console.log('[JWT Guard] Token expired');
      throw new UnauthorizedException('Access token expired');
    }

    // 4. Получаем активный Handle (из сессии или находим primary)
    let activeHandle = session.activeHandle;
    
    console.log(`[JWT Guard] Session ${session.id}:`, {
      activeHandleId: session.activeHandleId,
      hasActiveHandleRelation: !!activeHandle,
      identityId: session.identityId,
    });
    
    // Если relation не загружена, но activeHandleId существует, загружаем handle
    if (!activeHandle && session.activeHandleId) {
      console.log(`[JWT Guard] Loading activeHandle from activeHandleId: ${session.activeHandleId}`);
      activeHandle = await this.handleService.findById(session.activeHandleId);
      console.log(`[JWT Guard] Loaded activeHandle:`, {
        id: activeHandle?.id,
        value: activeHandle?.value,
      });
    }
    
    // Если до сих пор нет activeHandle, используем primary
    if (!activeHandle) {
      console.log(`[JWT Guard] No activeHandle found, fetching primary handle for identity ${session.identityId}`);
      const primaryHandle = await this.handleService.getPrimaryHandle(session.identityId);
      if (primaryHandle) {
        console.log(`[JWT Guard] Using primary handle:`, {
          id: primaryHandle.id,
          value: primaryHandle.value,
        });
        // Обновляем сессию с активным Handle
        session.activeHandleId = primaryHandle.id;
        session.activeHandle = primaryHandle;
        session.lastActiveAt = new Date();
        await this.sessionService.saveSession(session); // Используем существующий метод save
        activeHandle = primaryHandle;
      }
    }
    
    console.log(`[JWT Guard] Final activeHandle for session ${session.id}:`, {
      id: activeHandle?.id,
      value: activeHandle?.value,
    });

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
