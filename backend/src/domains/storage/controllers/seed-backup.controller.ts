import { Controller, Post, Get, Delete, Body, UseGuards, Req, Param } from '@nestjs/common';
import { JwtSessionGuard } from '../../user/guards/jwt-session.guard';
import { StorageService } from '../storage.service';
import { UploadSeedBackupDto, SeedBackupResponseDto } from '../dto/seed-backup.dto';
import { UsernameService } from '../../username/services/username.service';

@Controller('storage/auth')
export class SeedBackupController {
  constructor(
    private storageService: StorageService,
    private usernameService: UsernameService
  ) {}

  @Post('upload')
  @UseGuards(JwtSessionGuard)
  async uploadSeedBackup(
    @Body() dto: UploadSeedBackupDto,
    @Req() req: any
  ): Promise<{ success: boolean }> {
    const userId = req.user.id;
    const publicKey = req.user.publicKey;

    console.log('[SeedBackup] Upload request - userId:', userId);
    console.log('[SeedBackup] DTO received:', dto);

    // Convert publicKey to base64 string if it's a Buffer
    const publicKeyBase64 = Buffer.isBuffer(publicKey) ? publicKey.toString('base64') : publicKey;

    // Формируем объект для сохранения
    const backupData: SeedBackupResponseDto = {
      ...dto,
      publicKey: publicKeyBase64,
      createdAt: Date.now(),
    };

    // Получаем pre-signed URL для загрузки
    const key = `users/${userId}/auth/seed.enc`;
    console.log('[SeedBackup] S3 key:', key);

    const uploadUrl = await this.storageService.getPresignedUrlForUpload(key, 'application/json');
    console.log('[SeedBackup] Pre-signed URL generated:', uploadUrl);

    // Загружаем данные в S3
    const s3Response = await fetch(uploadUrl, {
      method: 'PUT',
      body: JSON.stringify(backupData),
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('[SeedBackup] S3 upload status:', s3Response.status);

    if (!s3Response.ok) {
      const errorText = await s3Response.text();
      console.error('[SeedBackup] S3 upload failed:', errorText);
      throw new Error(`S3 upload failed: ${s3Response.status}`);
    }

    console.log('[SeedBackup] Upload successful');
    return { success: true };
  }

  @Get('download')
  @UseGuards(JwtSessionGuard)
  async downloadSeedBackup(@Req() req: any): Promise<SeedBackupResponseDto> {
    const userId = req.user.id;
    const key = `users/${userId}/auth/seed.enc`;

    // Получаем pre-signed URL для скачивания
    const downloadUrl = await this.storageService.getPresignedUrlForDownload(key);

    // Скачиваем данные из S3
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error('Seed backup not found');
    }

    return await response.json();
  }

  @Get('download/by-username/:username')
  async downloadSeedBackupByUsername(
    @Param('username') username: string
  ): Promise<SeedBackupResponseDto> {
    console.log('[SeedBackup] Download by username:', username);

    // Lookup user by username
    const usernameRecord = await this.usernameService.findUserByUsername(username);
    if (!usernameRecord) {
      throw new Error('Username not found');
    }

    const userId = usernameRecord.id;
    const key = `users/${userId}/auth/seed.enc`;
    console.log('[SeedBackup] S3 key:', key);

    // Get pre-signed URL
    const downloadUrl = await this.storageService.getPresignedUrlForDownload(key);
    console.log('[SeedBackup] Pre-signed URL generated');

    // Download from S3
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      console.error('[SeedBackup] S3 download failed:', response.status);
      throw new Error('Seed backup not found');
    }

    const data = await response.json();
    console.log('[SeedBackup] Download successful');
    return data;
  }

  @Delete('delete')
  @UseGuards(JwtSessionGuard)
  async deleteSeedBackup(@Req() req: any): Promise<{ success: boolean }> {
    const userId = req.user.id;
    const key = `users/${userId}/auth/seed.enc`;

    await this.storageService.deleteObject(key);

    return { success: true };
  }
}
