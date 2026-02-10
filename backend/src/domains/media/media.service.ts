import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import sharp from 'sharp';

export enum MediaType {
  AVATAR = 'avatar',
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  SEED = 'seed',
  BACKUP = 'backup',
}

@Injectable()
export class MediaService {
  private s3: S3Client;
  private bucket: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('STORAGE_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
    this.bucket = this.configService.get<string>('STORAGE_BUCKET_NAME') || 'besafe.backet';
    this.baseUrl = `https://s3.tebi.io/${this.bucket}`;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY are required');
    }

    this.s3 = new S3Client({
      endpoint: endpoint || 'https://s3.tebi.io',
      region: 'auto',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  // Upload methods
  async uploadAvatar(handleId: string, imageBuffer: Buffer): Promise<string> {
    const processedImage = await this.processImageForAvatar(imageBuffer);
    const path = this.getAvatarPath(handleId);

    await this.uploadToS3(path, processedImage, 'image/png');
    return this.getPublicUrl(path);
  }

  async uploadImage(handleId: string, imageBuffer: Buffer, messageId?: string): Promise<string> {
    const filename = messageId ? `${messageId}_${Date.now()}.jpg` : `${Date.now()}.jpg`;
    const path = this.getMediaPath(handleId, 'images', filename);

    await this.uploadToS3(path, imageBuffer, 'image/jpeg');
    return this.getPublicUrl(path);
  }

  async uploadDocument(
    handleId: string,
    docBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const safeName = this.sanitizeFilename(filename);
    const path = this.getMediaPath(handleId, 'documents', safeName);

    await this.uploadToS3(path, docBuffer, contentType);
    return this.getPublicUrl(path);
  }

  async uploadAudio(handleId: string, audioBuffer: Buffer, messageId?: string): Promise<string> {
    const filename = messageId ? `${messageId}_voice.mp3` : `${Date.now()}.mp3`;
    const path = this.getMediaPath(handleId, 'audio', filename);

    await this.uploadToS3(path, audioBuffer, 'audio/mpeg');
    return this.getPublicUrl(path);
  }

  async uploadVideo(handleId: string, videoBuffer: Buffer, messageId?: string): Promise<string> {
    const filename = messageId ? `${messageId}_${Date.now()}.mp4` : `${Date.now()}.mp4`;
    const path = this.getMediaPath(handleId, 'videos', filename);

    await this.uploadToS3(path, videoBuffer, 'video/mp4');
    return this.getPublicUrl(path);
  }

  async uploadSeed(passwordHash: string, encryptedSeed: Buffer): Promise<void> {
    const path = this.getSeedPath(passwordHash);
    await this.uploadToS3(path, encryptedSeed, 'application/octet-stream');
  }

  async uploadBackup(handleId: string, backupBuffer: Buffer, type: string): Promise<string> {
    const filename = `${type}_${Date.now()}.enc`;
    const path = this.getBackupPath(handleId, filename);

    await this.uploadToS3(path, backupBuffer, 'application/octet-stream');
    return this.getPublicUrl(path);
  }

  // Delete methods
  async deleteAvatar(handleId: string): Promise<void> {
    const path = this.getAvatarPath(handleId);
    await this.deleteFromS3(path);
  }

  async deleteFile(path: string): Promise<void> {
    await this.deleteFromS3(path);
  }

  // Get URL methods
  async getAvatarUrlIfExists(handleId: string): Promise<string | null> {
    const path = this.getAvatarPath(handleId);
    const exists = await this.fileExists(path);
    return exists ? this.getPublicUrl(path) : null;
  }

  getAvatarUrl(handleId: string): string {
    return this.getPublicUrl(this.getAvatarPath(handleId));
  }

  // getSeed is not used anywhere in the current codebase, so commenting out to avoid lint errors
  // async getSeed(_passwordHash: string): Promise<Buffer> {
  //   // Implementation would fetch from S3
  //   throw new Error('Not implemented yet');
  // }

  // Path generation methods (public for controller access)
  getHandleHash(handleId: string): string {
    return createHash('sha256').update(handleId).digest('hex').substring(0, 16);
  }

  getAvatarPath(handleId: string): string {
    const hash = this.getHandleHash(handleId);
    return `handles/${hash}/avatar.png`;
  }

  getMediaPath(handleId: string, type: string, filename: string): string {
    const hash = this.getHandleHash(handleId);
    return `handles/${hash}/media/${type}/${filename}`;
  }

  private getPasswordHash(password: string): string {
    return createHash('sha256').update(password).digest('hex').substring(0, 16);
  }

  private getSeedPath(passwordHash: string): string {
    return `seeds/${passwordHash}/seed.enc`;
  }

  private getBackupPath(handleId: string, filename: string): string {
    const hash = this.getHandleHash(handleId);
    return `handles/${hash}/backups/${filename}`;
  }

  private getPublicUrl(path: string): string {
    return `${this.baseUrl}/${path}`;
  }

  // S3 operations
  private async uploadToS3(key: string, data: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await this.s3.send(command);
  }

  private async deleteFromS3(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3.send(command);
    } catch {
      // Ignore 404 errors
    }
  }

  private async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3.send(command);
      return true;
    } catch {
      return false;
    }
  }

  // File processing
  private async processImageForAvatar(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(256, 256, { fit: 'cover', position: 'center' })
        .png({ quality: 90 })
        .toBuffer();
    } catch (error) {
      console.error('Image processing error:', error);
      return buffer; // Fallback to original
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  // Validation
  validateContentType(contentType: string): void {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg',
      'video/mp4',
      'application/octet-stream',
      'application/json',
    ];

    if (!supportedTypes.includes(contentType)) {
      throw new BadRequestException(`Unsupported content type: ${contentType}`);
    }
  }
}
