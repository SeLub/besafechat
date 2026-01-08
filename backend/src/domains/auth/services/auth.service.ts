import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IdentityService } from '../../identity/services/identity.service';
import { SessionService } from '../../session/services/session.service';

@Injectable()
export class AuthService {
  constructor(
    private identityService: IdentityService,
    private sessionService: SessionService
  ) {}

  async registerIdentity(
    publicKeyBase64: string,
    deviceId: string,
    deviceModel?: string,
    ipAddress?: string
  ) {
    // Register or find the identity
    const identity = await this.identityService.registerIdentity(publicKeyBase64);

    // Create a new session
    return await this.sessionService.createSession(identity.id, deviceId, deviceModel, ipAddress);
  }

  async loginWithPublicKey(
    publicKeyBase64: string,
    deviceId: string,
    deviceModel?: string,
    ipAddress?: string
  ) {
    // Find the identity by public key
    let identity = await this.identityService.findByIdentityPublicKey(publicKeyBase64);
    if (!identity) {
      // If identity doesn't exist, register it (this handles first-time login)
      identity = await this.identityService.registerIdentity(publicKeyBase64);
    }

    // Create a new session
    return await this.sessionService.createSession(identity.id, deviceId, deviceModel, ipAddress);
  }

  async logout(identityId: string, sessionId: string) {
    await this.sessionService.revokeSession(identityId, sessionId);
  }

  async refreshTokens(refreshToken: string, ipAddress?: string) {
    return await this.sessionService.refreshSession(refreshToken, ipAddress);
  }

  async getIdentityProfile(identityId: string) {
    const identity = await this.identityService.findByIdentityId(identityId);
    if (!identity) {
      throw new UnauthorizedException('Identity not found');
    }

    // For now, return basic identity information
    // In the future, this could include profile information
    return {
      id: identity.id,
      publicKey: identity.masterPublicKey?.toString('base64') || null,
      createdAt: identity.createdAt,
    };
  }

  async getIdentitySessions(identityId: string, currentSessionId: string) {
    return await this.sessionService.findActiveSessionsByIdentityId(identityId, currentSessionId);
  }

  async revokeSessionById(identityId: string, sessionIdToRevoke: string, currentSessionId: string) {
    await this.sessionService.revokeSessionById(identityId, sessionIdToRevoke, currentSessionId);
  }

  async revokeAllSessions(identityId: string, excludeSessionId?: string) {
    await this.sessionService.revokeAllSessions(identityId, excludeSessionId);
  }
}
