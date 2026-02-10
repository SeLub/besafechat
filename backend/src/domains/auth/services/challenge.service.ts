import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../../../domains/redis/redis.service';

export interface ChallengeData {
  publicKey: string;
  challenge: string;
  action: 'register' | 'login';
  createdAt: number;
  expiresAt: number;
  attempts: number;
  ip: string;
}

@Injectable()
export class ChallengeService {
  private readonly CHALLENGE_TTL = 120; // 2 minutes in seconds
  private readonly MAX_ATTEMPTS = 5;

  constructor(private redisService: RedisService) {}

  /**
   * Create a new challenge for authentication
   */
  async createChallenge(
    publicKey: string,
    action: 'register' | 'login',
    ip: string
  ): Promise<{ challengeId: string; challenge: string; expiresAt: number }> {
    // Generate a random challenge (32 bytes = 256 bits)
    const challenge = randomBytes(32).toString('base64');

    // Generate a unique challenge ID
    const challengeId = randomBytes(16).toString('hex');

    const now = Date.now();
    const expiresAt = now + this.CHALLENGE_TTL * 1000; // Convert to milliseconds

    const challengeData: ChallengeData = {
      publicKey,
      challenge,
      action,
      createdAt: now,
      expiresAt,
      attempts: 0,
      ip,
    };

    // Store in Redis with TTL
    const redis = this.redisService.getClient();
    await redis.setex(
      `challenge:${challengeId}`,
      this.CHALLENGE_TTL,
      JSON.stringify(challengeData)
    );

    return {
      challengeId,
      challenge,
      expiresAt,
    };
  }

  /**
   * Validate a challenge response (signature)
   */
  async validateChallenge(
    challengeId: string,
    publicKey: string,
    signature: string,
    ip: string
  ): Promise<boolean> {
    const redis = this.redisService.getClient();
    const challengeKey = `challenge:${challengeId}`;

    // Get the challenge data from Redis
    const challengeDataStr = await redis.get(challengeKey);

    if (!challengeDataStr) {
      throw new UnauthorizedException('Challenge not found or expired');
    }

    const challengeData: ChallengeData = JSON.parse(challengeDataStr);

    // Check if challenge is expired
    if (Date.now() > challengeData.expiresAt) {
      await redis.del(challengeKey); // Clean up expired challenge
      throw new UnauthorizedException('Challenge has expired');
    }

    // Check if IP matches (for basic security)
    if (challengeData.ip !== ip) {
      // Increment attempts counter
      challengeData.attempts += 1;
      await redis.setex(
        challengeKey,
        Math.floor((challengeData.expiresAt - Date.now()) / 1000), // Remaining TTL
        JSON.stringify(challengeData)
      );

      if (challengeData.attempts >= this.MAX_ATTEMPTS) {
        await redis.del(challengeKey); // Remove after max attempts
      }

      throw new UnauthorizedException('IP mismatch for this challenge');
    }

    // Verify that the public key matches
    if (challengeData.publicKey !== publicKey) {
      // Increment attempts counter
      challengeData.attempts += 1;
      await redis.setex(
        challengeKey,
        Math.floor((challengeData.expiresAt - Date.now()) / 1000), // Remaining TTL
        JSON.stringify(challengeData)
      );

      if (challengeData.attempts >= this.MAX_ATTEMPTS) {
        await redis.del(challengeKey); // Remove after max attempts
      }

      throw new UnauthorizedException('Public key mismatch');
    }

    // Verify the signature (this will be done by calling the crypto verification function)
    // For now, we'll return true, but in real implementation, this should verify the Ed25519 signature
    const isValid = await this.verifySignature(publicKey, challengeData.challenge, signature);

    if (!isValid) {
      // Increment attempts counter
      challengeData.attempts += 1;
      await redis.setex(
        challengeKey,
        Math.floor((challengeData.expiresAt - Date.now()) / 1000), // Remaining TTL
        JSON.stringify(challengeData)
      );

      if (challengeData.attempts >= this.MAX_ATTEMPTS) {
        await redis.del(challengeKey); // Remove after max attempts
      }

      throw new UnauthorizedException('Invalid signature');
    }

    // Challenge is valid, remove it from Redis to prevent reuse (replay attack protection)
    await redis.del(challengeKey);

    return true;
  }

  /**
   * Verify Ed25519 signature
   * This is a placeholder - in a real implementation, this would call the crypto verification
   */
  private async verifySignature(
    publicKey: string,
    challenge: string,
    signature: string
  ): Promise<boolean> {
    // In a real implementation, this would decode the base64 public key and signature,
    // and use Ed25519 verification to check if the signature is valid for the challenge
    // using the provided public key.

    // For now, this is a placeholder that would integrate with the crypto library
    // The actual implementation would likely involve:
    // 1. Converting base64 public key to bytes
    // 2. Converting base64 signature to bytes
    // 3. Converting base64 challenge to bytes
    // 4. Using Ed25519.verify(signature, message, publicKey)

    // Placeholder implementation - this should be replaced with actual Ed25519 verification
    console.log(`Verifying signature for public key: ${publicKey}, challenge: ${challenge}`);

    // The @noble/ed25519 library requires a SHA-512 hash function to be configured
    // We need to configure it properly for server-side usage
    try {
      const nobleEd = await import('@noble/ed25519');
      const { sha512 } = await import('@noble/hashes/sha2.js');

      // Configure the sha512 implementation for @noble/ed25519
      (nobleEd as any).hashes.sha512 = sha512;
      (nobleEd as any).hashes.sha512Async = (m: Uint8Array) => Promise.resolve(sha512(m));

      const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'base64'));
      const signatureBytes = new Uint8Array(Buffer.from(signature, 'base64'));
      const challengeBytes = new TextEncoder().encode(challenge);

      return await nobleEd.verify(signatureBytes, challengeBytes, publicKeyBytes);
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Cleanup expired challenges (called periodically)
   */
  async cleanupExpiredChallenges(): Promise<number> {
    // Note: In Redis, expired keys are automatically removed based on TTL
    // This method could be used to perform any additional cleanup if needed
    // For now, we rely on Redis's built-in TTL mechanism
    return 0;
  }
}
