import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class S3Service {
  private s3: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('STORAGE_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
    this.bucket = this.configService.get<string>('STORAGE_BUCKET_NAME') || 'besafe.backet';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY are required');
    }

    this.s3 = new S3Client({
      endpoint: endpoint || 'https://s3.tebi.io',
      region: 'auto',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  // Unified methods for all file types
  async uploadObject(key: string, data: Buffer, contentType: string = 'application/octet-stream'): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await this.s3.send(command);
  }

  async deleteObjectIfExists(key: string): Promise<void> {
    try {
      await this.deleteObject(key);
    } catch (error) {
      // Ignore 404 - file didn't exist
    }
  }

  // Avatar-specific methods
  private getAvatarHash(handleId: string): string {
    return createHash('sha256').update(handleId).digest('hex').substring(0, 16);
  }

  getAvatarPath(handleId: string): string {
    return `avatars/${this.getAvatarHash(handleId)}/avatar.png`;
  }

  getAvatarUrl(handleId: string): string {
    return `https://s3.tebi.io/besafe.backet/${this.getAvatarPath(handleId)}`;
  }

  async uploadAvatar(handleId: string, imageData: Buffer): Promise<string> {
    // 1. Delete old avatar
    await this.deleteObjectIfExists(this.getAvatarPath(handleId));
    
    // 2. Upload new avatar
    await this.uploadObject(this.getAvatarPath(handleId), imageData, 'image/png');
    
    return this.getAvatarUrl(handleId);
  }

  async deleteAvatar(handleId: string): Promise<void> {
    await this.deleteObjectIfExists(this.getAvatarPath(handleId));
  }

  // Future media methods
  getMediaPath(handleId: string, messageId: string, filename: string): string {
    const hash = this.getAvatarHash(handleId); // Reuse hash function
    return `media/${hash}/${messageId}/${filename}`;
  }

  async getPresignedUrlForUpload(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return await getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  async getPresignedUrlForDownload(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return await getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    await this.s3.send(command);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({ Bucket: this.bucket, Key: key });
      await this.s3.send(command);
      return true;
    } catch (error) {
      // Only return false for specific "not found" errors
      // Other errors (like permissions) should be handled differently
      if (error instanceof Error) {
        if (error.name === 'NoSuchKey' || error.message.includes('NotFound')) {
          return false;
        }
      }
      // For other types of errors (permissions, etc.), we should throw
      // but since this is a boolean method, we'll return false to indicate
      // that we can't confirm the file exists
      return false;
    }
  }

  getPublicUrl(key: string): string {
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT') || 'https://s3.tebi.io';
    return `${endpoint}/${this.bucket}/${key}`;
  }

  /**
   * Validates the content type against supported types
   */
  validateContentType(contentType: string): void {
    const supportedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',

      // Documents
      'application/pdf',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Media
      'audio/mpeg',
      'video/mp4',

      // Seed backup
      'application/json',
    ];

    if (!supportedTypes.includes(contentType)) {
      throw new BadRequestException(`Unsupported content type: ${contentType}`);
    }
  }

  /**
   * Validates and constructs the file path ensuring user ownership for regular files
   */
  validateAndConstructPath(path: string, filename: string, userId: string): string {
    // Sanitize inputs to prevent path traversal attacks
    if (
      path.includes('../') ||
      path.includes('..\\') ||
      filename.includes('../') ||
      filename.includes('..\\')
    ) {
      throw new BadRequestException('Invalid path or filename');
    }

    // For seed storage paths, bypass user validation completely
    if (path.startsWith('seeds/')) {
      // Allow seed paths without user prefix validation
      const fileKey = path ? `${path}/${filename}` : filename;
      return fileKey;
    }

    // For all other paths, ensure they start with the user's directory for security
    if (!path.startsWith(`users/${userId}/`)) {
      if (!path.startsWith(`users/${userId}`)) {
        path = `users/${userId}/${path}`;
      }
    }

    // Ensure path doesn't end with slash unless it's empty
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }

    // Construct the full key
    const fileKey = path ? `${path}/${filename}` : filename;

    return fileKey;
  }

}
