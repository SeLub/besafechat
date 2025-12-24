import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { SessionService } from './session.service';
import { User } from '../user.entity';

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

  async register(
    publicKey: string,
    deviceId: string,
    deviceModel?: string,
    ipAddress?: string
  ): Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }> {
    const user = await this.userService.registerUser(publicKey);

    // Ensure deviceId is not empty, null, or undefined
    let finalDeviceId = deviceId;
    if (!finalDeviceId || finalDeviceId.trim() === '') {
      finalDeviceId = `web-device-${Date.now()}`;
    }

    const { session, tokens } = await this.sessionService.createSession(
      user.id,
      finalDeviceId,
      deviceModel,
      ipAddress
    );
    return { user: session.user, tokens };
  }
}
