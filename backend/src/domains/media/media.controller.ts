import {
  BadRequestException,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { CurrentHandle } from '../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../session/guards/jwt-session.guard';
import { MediaService, MediaType } from './media.service';

interface MulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@ApiTags('media')
@Controller('media')
@UseGuards(JwtSessionGuard)
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('upload/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only images allowed'), false);
        }
      },
    })
  )
  @ApiOperation({
    summary: 'Upload avatar',
    description:
      'Upload avatar image. Will be auto-resized to 256x256 PNG. Max size: 5MB. Supported formats: JPG, PNG, GIF, WebP.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Avatar image file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPG, PNG, GIF, WebP) - max 5MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example: 'https://s3.tebi.io/besafe.backet/handles/d4461b295551e5da/avatar.png',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadAvatar(@CurrentHandle() handle: any, @UploadedFile() file: MulterFile) {
    if (!file) throw new BadRequestException('No file provided');

    const url = await this.mediaService.uploadAvatar(handle.id, file.buffer);
    return new ApiResponseDto(true, { url });
  }

  @Post('upload/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only images allowed'), false);
        }
      },
    })
  )
  @ApiOperation({
    summary: 'Upload image for chat',
    description:
      'Upload image for chat messages. Max size: 10MB. Supported formats: JPG, PNG, GIF, WebP.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file and optional message ID',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPG, PNG, GIF, WebP) - max 10MB',
        },
        messageId: {
          type: 'string',
          description: 'Optional message ID to associate with image',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example:
                'https://s3.tebi.io/besafe.backet/handles/d4461b295551e5da/media/images/1738095123456.jpg',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadImage(@CurrentHandle() handle: any, @UploadedFile() file: MulterFile) {
    if (!file) throw new BadRequestException('No file provided');

    const url = await this.mediaService.uploadImage(handle.id, file.buffer);
    return new ApiResponseDto(true, { url });
  }

  @Post('upload/document')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    })
  )
  @ApiOperation({
    summary: 'Upload document',
    description:
      'Upload document file. Max size: 50MB. Supported formats: PDF, DOC, DOCX, XLS, XLSX, TXT.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Document file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, DOC, DOCX, XLS, XLSX, TXT) - max 50MB',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Document uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example:
                'https://s3.tebi.io/besafe.backet/handles/d4461b295551e5da/media/documents/document.pdf',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file type or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadDocument(@CurrentHandle() handle: any, @UploadedFile() file: MulterFile) {
    if (!file) throw new BadRequestException('No file provided');

    this.mediaService.validateContentType(file.mimetype);
    const url = await this.mediaService.uploadDocument(
      handle.id,
      file.buffer,
      file.originalname,
      file.mimetype
    );
    return new ApiResponseDto(true, { url });
  }

  @Post('upload/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only audio files allowed'), false);
        }
      },
    })
  )
  @ApiOperation({
    summary: 'Upload audio/voice message',
    description:
      'Upload audio file for voice messages. Max size: 20MB. Supported formats: MP3, WAV, OGG.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Audio file and optional message ID',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Audio file (MP3, WAV, OGG) - max 20MB',
        },
        messageId: {
          type: 'string',
          description: 'Optional message ID to associate with audio',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Audio uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example:
                'https://s3.tebi.io/besafe.backet/handles/d4461b295551e5da/media/audio/1738095123456_voice.mp3',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file type or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadAudio(@CurrentHandle() handle: any, @UploadedFile() file: MulterFile) {
    if (!file) throw new BadRequestException('No file provided');

    const url = await this.mediaService.uploadAudio(handle.id, file.buffer);
    return new ApiResponseDto(true, { url });
  }

  @Post('upload/video')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only video files allowed'), false);
        }
      },
    })
  )
  @ApiOperation({
    summary: 'Upload video file',
    description:
      'Upload video file for chat messages. Max size: 25MB. Supported formats: MP4, WEBM, OGG, MOV.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Video file and optional message ID',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Video file (MP4, WEBM, OGG, MOV) - max 25MB',
        },
        messageId: {
          type: 'string',
          description: 'Optional message ID to associate with video',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Video uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example:
                'https://s3.tebi.io/besafe.backet/handles/d4461b295551e5da/media/videos/1738095123456_video.mp4',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file type or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadVideo(@CurrentHandle() handle: any, @UploadedFile() file: MulterFile) {
    if (!file) throw new BadRequestException('No file provided');

    const url = await this.mediaService.uploadVideo(handle.id, file.buffer);
    return new ApiResponseDto(true, { url });
  }

  @Post('upload/seed/:passwordHash')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 }, // 1KB - encrypted seed is small
    })
  )
  @ApiOperation({
    summary: 'Upload encrypted seed for cloud backup',
    description:
      'Upload encrypted seed phrase for cloud recovery. Max size: 1KB. Used for account recovery.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'passwordHash',
    description: 'Password hash for seed encryption',
    example: 'abc123def456',
  })
  @ApiBody({
    description: 'Encrypted seed file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Encrypted seed file - max 1KB',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Seed uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Seed uploaded successfully' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - missing file or password hash' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadSeed(@UploadedFile() file: MulterFile, @Param('passwordHash') passwordHash: string) {
    if (!file) throw new BadRequestException('No file provided');
    if (!passwordHash) throw new BadRequestException('Password hash required');

    await this.mediaService.uploadSeed(passwordHash, file.buffer);
    return new ApiResponseDto(true, { message: 'Seed uploaded successfully' });
  }

  @Delete('avatar')
  @ApiOperation({
    summary: 'Delete current avatar',
    description: 'Delete the current user avatar from storage. This action cannot be undone.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Avatar deleted successfully' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAvatar(@CurrentHandle() handle: any) {
    await this.mediaService.deleteAvatar(handle.id);
    return new ApiResponseDto(true, { message: 'Avatar deleted successfully' });
  }

  @Delete(':type/:filepath')
  @ApiOperation({
    summary: 'Delete media file',
    description:
      'Delete a specific media file by type and path. Only files owned by current user can be deleted.',
  })
  @ApiParam({
    name: 'type',
    enum: MediaType,
    description: 'Type of media file (avatar, image, document, audio, seed, backup)',
  })
  @ApiParam({
    name: 'filepath',
    description: 'File path relative to media type directory',
    example: 'images/1738095123456.jpg',
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'File deleted successfully' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid file path' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(
    @Param('type') type: MediaType,
    @Param('filepath') filepath: string,
    @CurrentHandle() handle: any
  ) {
    // Construct full path based on type and handle
    let fullPath: string;

    switch (type) {
      case MediaType.AVATAR:
        fullPath = this.mediaService.getAvatarPath(handle.id);
        break;
      case MediaType.IMAGE:
        fullPath = this.mediaService.getMediaPath(handle.id, 'images', filepath);
        break;
      case MediaType.DOCUMENT:
        fullPath = this.mediaService.getMediaPath(handle.id, 'documents', filepath);
        break;
      case MediaType.AUDIO:
        fullPath = this.mediaService.getMediaPath(handle.id, 'audio', filepath);
        break;
      default:
        throw new BadRequestException('Unsupported media type');
    }

    await this.mediaService.deleteFile(fullPath);
    return new ApiResponseDto(true, { message: 'File deleted successfully' });
  }
}
