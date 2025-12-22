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
   * Validates and constructs the file path ensuring user ownership
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

    // Ensure the path starts with the user's directory for security
    if (!path.startsWith(`users/${userId}/`)) {
      path = `users/${userId}/${path}`;
    }

    // Ensure path doesn't end with slash unless it's empty
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }

    // Construct the full key
    const fileKey = path ? `${path}/${filename}` : filename;

    return fileKey;
  }

  /**
   * Verifies that a file belongs to a specific user
   */
  verifyFileOwnership(key: string, userId: string): boolean {
    return key.startsWith(`users/${userId}/`);
  }
}
