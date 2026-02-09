import { API_CONFIG } from './api-config';

interface ClaimResult {
  success: boolean;
  reason?: 'already_claimed' | 'network_error' | 'invalid_format' | 'max_retries_exceeded';
  message?: string;
  retryAfter?: number; // seconds
}

export class PasswordRecoveryService {
  static async checkPasswordAvailability(password: string): Promise<boolean> {
    try {
      // Compute hash the same way as for S3 storage path
      const passwordHash = await this.computePasswordHash(password);

      const response = await fetch(`${API_CONFIG.BASE_URL}/password-recovery/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_hash: passwordHash }),
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Too many requests
          throw new Error('Too many requests. Please try again later.');
        }
        if (response.status === 503) {
          // Service unavailable
          throw new Error('Recovery service temporarily unavailable');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.available;
    } catch (error) {
      console.error('Password availability check failed:', error);
      throw error;
    }
  }

  static async claimPasswordWithRetry(
    password: string,
    maxRetries: number = 3
  ): Promise<ClaimResult> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const passwordHash = await this.computePasswordHash(password);

        const response = await fetch(`${API_CONFIG.BASE_URL}/password-recovery/claim`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password_hash: passwordHash,
            user_agent: navigator.userAgent,
          }),
          credentials: 'include',
        });

        if (response.status === 409) {
          // Conflict - already claimed
          return {
            success: false,
            reason: 'already_claimed',
            message:
              'This password is already in use by another account. Please choose a different password.',
          };
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        return {
          success: true,
          message: result.message,
        };
      } catch (error: any) {
        console.error(`Password claim attempt ${attempt} failed:`, error);

        if (attempt === maxRetries) {
          return {
            success: false,
            reason: error.message?.includes('network') ? 'network_error' : 'invalid_format',
            message: error.message,
          };
        }

        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return {
      success: false,
      reason: 'max_retries_exceeded',
      message: 'Max retries exceeded',
    };
  }

  /**
   * Restore seed by password (retrieves from location based on identityId, decrypts with password)
   */
  static async restoreSeedByPassword(password: string): Promise<string[] | null> {
    try {
      // Compute password hash to look up identity
      const passwordHash = await this.computePasswordHash(password);

      // First, we need to identify the user somehow - this would require a new endpoint
      // or using the existing handle-based lookup system
      // For now, this is a placeholder that would need the identity lookup endpoint
      const response = await fetch(`${API_CONFIG.BASE_URL}/password-recovery/lookup-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_hash: passwordHash }),
        credentials: 'include',
      });

      if (response.status === 404) {
        throw new Error('No account found for this password');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const { identityId } = await response.json();

      // Now download the seed using the identityId
      // This would use the identity-based storage path instead of password-based
      const s3Url = `https://s3.tebi.io/besafe.backet/seeds/${identityId}/seed.enc`;
      const seedResponse = await fetch(s3Url);

      if (!seedResponse.ok) {
        throw new Error('Seed backup not found');
      }

      const encryptedSeed = await seedResponse.json();

      // Attempt to decrypt with the provided password
      try {
        const { decryptSeedFromCloud } = await import('../lib/crypto');
        const seed = await decryptSeedFromCloud(encryptedSeed, password, identityId);
        return seed;
      } catch (decryptionError) {
        console.error('Decryption failed - likely wrong password:', decryptionError);
        throw new Error('Invalid password');
      }
    } catch (error) {
      console.error('Seed recovery failed:', error);
      return null;
    }
  }

  private static async computePasswordHash(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert to hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
