import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtSessionGuard } from '../../user/guards/jwt-session.guard';
import { StorageService } from '../storage.service';
import { UploadDto } from '../dto/upload.dto';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

// Define interface for request with user property
interface RequestWithUser {
  user?: {
    id: string;
    sessionId: string;
    publicKey: Buffer;
  };
  url: string;
}

@ApiTags('Storage')
@Controller('storage')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Get presigned URL for file upload' })
  async getUploadUrl(@Req() req: RequestWithUser, @Body() dto: UploadDto) {
    const userId = req.user!.id;
    const { fileType, contentType, filename } = dto;

    // Validate content type
    if (
      !contentType.startsWith('image/') &&
      !contentType.startsWith('video/') &&
      !contentType.startsWith('audio/') &&
      !contentType.startsWith('application/')
    ) {
      throw new BadRequestException('Invalid content type');
    }

    // Generate file key based on type
    let fileKey: string;

    switch (fileType) {
      case 'avatar': {
        const extensions = ['png', 'jpg', 'jpeg', 'webp'];
        for (const oldExt of extensions) {
          try {
            await this.storageService.deleteObject(`users/${userId}/avatar.${oldExt}`);
          } catch {
            // File doesn't exist, ignore
          }
        }
        fileKey = `users/${userId}/avatar.png`;
        break;
      }
      case 'image':
      case 'video':
      case 'audio': {
        if (!filename) throw new BadRequestException('Filename required for media files');
        fileKey = `users/${userId}/media/${Date.now()}-${filename}`;
        break;
      }
      case 'document': {
        if (!filename) throw new BadRequestException('Filename required for documents');
        fileKey = `users/${userId}/documents/${filename}`;
        break;
      }
      default:
        throw new BadRequestException('Invalid file type');
    }

    const uploadUrl = await this.storageService.getPresignedUrlForUpload(fileKey, contentType);

    return { uploadUrl, fileKey };
  }

  @Get('download/*')
  @ApiOperation({ summary: 'Get presigned URL for file download' })
  async getDownloadUrl(@Req() req: RequestWithUser) {
    const key = req.url.replace('/storage/download/', '');
    const downloadUrl = await this.storageService.getPresignedUrlForDownload(key);
    return { downloadUrl };
  }

  @Delete('*')
  @ApiOperation({ summary: 'Delete file from storage' })
  async deleteFile(@Req() req: RequestWithUser) {
    const key = req.url.replace('/storage/', '');
    const userId = req.user!.id;

    // Verify user owns the file
    if (!key.startsWith(`users/${userId}/`)) {
      throw new BadRequestException('Cannot delete files from other users');
    }

    await this.storageService.deleteObject(key);
    return { success: true };
  }
}
