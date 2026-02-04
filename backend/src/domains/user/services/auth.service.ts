import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private sessionService: SessionService
  ) {}

  async loginWithPublicKey(
    publicKeyBase64: string,
    deviceId: string,
    deviceModel?: string,
    ipAddress?: string
  ) {
    // Находим или создаём пользователя
    let user = await this.userService.findByPublicKey(publicKeyBase64);
    if (!user) {
      user = await this.userService.registerUser(publicKeyBase64);
    }

    // Создаём сессию
    return this.sessionService.createSession(user.id, deviceId, deviceModel, ipAddress);
  }
}
