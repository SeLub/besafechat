# Account Recovery Authentication Flow Solution

## Problem Statement
The current S3 endpoints require authentication via `@UseGuards(JwtSessionGuard)`, but during account recovery, the user doesn't have a valid session yet. The commit message indicates there should be a public recovery endpoint at `/storage/auth/download/by-username/:username`, but this endpoint doesn't exist in the current codebase.

## Current Architecture Analysis
- Account recovery currently happens via `AccountService.recoverWithPassword()` which:
 1. Looks up the user by username via `/username/search/:username` (public endpoint)
  2. Gets the userId from the response
  3. Calls `CloudBackupService.restoreAndDecryptSeedByUserId()` which attempts to access S3 endpoints requiring authentication

## Security Analysis
The issue is that the current flow requires authentication for S3 operations, which creates a circular dependency where users need to be logged in to recover their account.

## Proposed Solution

### 1. Create a Public Recovery Endpoint
Add a new controller to handle public recovery operations without session authentication:

```typescript
// backend/src/domains/storage/controllers/seed-backup.controller.ts
import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { S3Service } from '../../s3/s3.service';
import { UsernameService } from '../../username/services/username.service';
import { UserService } from '../../user/services/user.service';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';

@Controller('storage/auth')
export class SeedBackupController {
  constructor(
    private s3Service: S3Service,
    private usernameService: UsernameService,
    private userService: UserService,
  ) {}

  @Get('download/by-username/:username')
  @HttpCode(HttpStatus.OK)
  async downloadSeedByUsername(
    @Param('username') username: string
  ): Promise<ApiResponseDto<any>> {
    try {
      // 1. Find user by username
      const user = await this.usernameService.findUserByUsername(username);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 2. Construct S3 key for the user's encrypted seed
      const fileKey = `users/${user.id}/auth/seed.enc`;

      // 3. Check if the file exists
      const exists = await this.s3Service.fileExists(fileKey);
      if (!exists) {
        throw new NotFoundException('No backup found for this user');
      }

      // 4. Generate presigned URL for download
      const downloadUrl = await this.s3Service.getPresignedUrlForDownload(fileKey);

      // Return the download URL
      return new ApiResponseDto(true, { downloadUrl, userId: user.id });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      return new ApiResponseDto(false, undefined, error.message || 'Download failed');
    }
  }
}
```

### 2. Update CloudBackupService to Use the New Endpoint
Modify the frontend service to use the new public recovery endpoint:

```typescript
// frontend/app/services/cloud-backup.service.ts
/**
 * Restore encrypted seed by username (public - no session required)
 * Used for account recovery flow
 */
async restoreSeedByUsername(username: string): Promise<EncryptedSeedData | null> {
  try {
    // Use the new public endpoint
    const response = await fetch(`${this.apiBaseUrl}/storage/auth/download/by-username/${encodeURIComponent(username)}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'No cloud backup found for this username');
    }
    
    const responseJson = await response.json();
    const presignedData = responseJson.data || responseJson;
    const downloadUrl = presignedData.downloadUrl;
    
    if (!downloadUrl) {
      throw new Error('No download URL provided by the server');
    }
    
    // Download the encrypted seed data from S3 using the presigned URL
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) {
      throw new Error(
        `S3 download failed: ${downloadResponse.status} - ${downloadResponse.statusText}`
      );
    }
    
    // The S3 returns the encrypted seed data
    const encryptedSeed: EncryptedSeedData = await downloadResponse.json();
    return encryptedSeed;
  } catch (error) {
    console.error('Restore by username failed:', error);
    return null;
  }
}

/**
 * Restore, decrypt and derive keys from backup using username (public - no session required)
 * Used for account recovery flow
 */
async restoreAccountByUsername(username: string, password: string): Promise<KeyPair> {
  const seedWords = await this.restoreSeedByUsername(username);
  
  if (!seedWords) {
    throw new Error('Failed to restore seed from backup');
  }
  
  // Decrypt the seed using the provided password
 try {
    const decryptedSeed = await decryptSeedFromCloud(seedWords, password, ''); // userId not needed for decryption
    const keyPair = await deriveKeyPairFromSeed(decryptedSeed);
    return keyPair;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Invalid password or corrupted backup');
  }
}
```

### 3. Update AccountService to Use the New Method
```typescript
// frontend/app/services/account.service.ts
static async recoverWithPassword(username: string, password: string) {
  const cloudService = new CloudBackupService();
  
  // Use the new public method that doesn't require authentication
  const { privateKey, publicKey, publicKeyBase64 } = 
    await cloudService.restoreAccountByUsername(username, password);

  // Save to IndexedDB
  await StorageService.storePublicKey(publicKeyBase64);

  return { privateKey, publicKey, publicKeyBase64 };
}
```

## Security Considerations

### 1. Access Control
- The endpoint only allows access to the user's own seed backup by username lookup
- No session authentication is required, but access is still tied to a specific user via username

### 2. Data Protection
- The actual seed data remains encrypted in S3 with Argon2id-derived keys
- The endpoint only provides a presigned URL for a limited time (1 hour by default)
- The seed data is encrypted with the user's password and cannot be decrypted without the correct password

### 3. Rate Limiting
- Should implement rate limiting to prevent brute force attacks on the username endpoint
- Consider adding CAPTCHA or other protection mechanisms for high-frequency requests

### 4. Audit Trail
- Log access attempts to the recovery endpoint for security monitoring
- Track failed attempts that might indicate malicious activity

### 5. Defense Against Username Enumeration
- The endpoint should return the same error message for both "username not found" and "no backup found" to prevent username enumeration
- This is already handled by the S3 service which returns a generic error when file doesn't exist

## Implementation Steps

1. Create the `SeedBackupController` with the public recovery endpoint
2. Update the `CloudBackupService` to use the new endpoint
3. Update the `AccountService` to use the new recovery method
4. Test the complete recovery flow without requiring authentication
5. Add security measures like rate limiting and audit logging

## Alternative Approaches

### Option 1: Temporary Token System
- Generate a temporary token during registration that can be used for recovery
- More complex but provides additional security layer

### Option 2: Challenge-Response System
- Implement a challenge-response mechanism for recovery
- More complex but allows for additional verification steps

### Option 3: Current Approach (Recommended)
- The proposed solution is the most straightforward and maintains security
- The encrypted seed in S3 provides sufficient protection
- The username-based lookup provides a user-friendly recovery mechanism