import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiResponse as SwaggerApiResponse,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { JwtSessionGuard } from '../../user/guards/jwt-session.guard';
import { UnifiedDeleteDto } from '../dto/unified-delete.dto';
import { UnifiedDownloadDto } from '../dto/unified-download.dto';
import { UnifiedUploadDto } from '../dto/unified-upload.dto';
import { S3Service } from '../s3.service';

// Define interface for request with user property
interface RequestWithUser {
  user?: {
    id: string;
    sessionId: string;
    publicKey: Buffer;
  };
  url: string;
}

class UploadResponseData {
  uploadUrl!: string;
  fileKey!: string;
}

class DownloadResponseData {
  downloadUrl!: string;
  fileKey!: string;
}

class DeleteResponseData {
  message!: string;
}

@ApiTags('S3')
@Controller('s3')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class S3Controller {
  constructor(private s3Service: S3Service) {}

  @Post('upload')
  @ApiOperation({ summary: 'Get presigned URL for file upload' })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Upload URL generated successfully',
    type: ApiResponseDto<UploadResponseData>,
  })
  @SwaggerApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request',
  })
  async getUploadUrl(
    @Req() req: RequestWithUser,
    @Body() dto: UnifiedUploadDto
  ): Promise<ApiResponseDto<UploadResponseData>> {
    try {
      const userId = req.user!.id;
      const { contentType, path, filename, fileType } = dto;

      // Validate content type
      this.s3Service.validateContentType(contentType);

      // Validate and construct the file key
      const fileKey = this.s3Service.validateAndConstructPath(path, filename, userId);

      // For seed uploads, we may want to add additional validation or logging
      if (fileKey.startsWith('seeds/')) {
        // Add logging for seed operations to track them separately if needed
        console.log(`Seed operation: ${fileKey} for user ${userId}`);
      }

      const uploadUrl = await this.s3Service.getPresignedUrlForUpload(fileKey, contentType);

      return new ApiResponseDto(true, { uploadUrl, fileKey });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return new ApiResponseDto<UploadResponseData>(
        false,
        undefined,
        error instanceof Error ? error.message : 'Upload URL generation failed'
      );
    }
  }

  @Post('download')
  @ApiOperation({ summary: 'Get presigned URL for file download' })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Download URL generated successfully',
    type: ApiResponseDto<DownloadResponseData>,
  })
  @SwaggerApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request or access denied',
  })
  async getDownloadUrl(
    @Req() req: RequestWithUser,
    @Body() dto: UnifiedDownloadDto
  ): Promise<ApiResponseDto<DownloadResponseData>> {
    try {
      const userId = req.user!.id;
      const { path, filename } = dto;

      // Validate and construct the file key
      const fileKey = this.s3Service.validateAndConstructPath(path, filename, userId);

      // For seed operations, we skip ownership verification
      if (fileKey.startsWith('seeds/')) {
        // Add logging for seed operations to track them separately if needed
        console.log(`Seed download operation: ${fileKey} for user ${userId}`);
      } else if (!fileKey.startsWith(`users/${userId}/`)) {
        return new ApiResponseDto<DownloadResponseData>(
          false,
          undefined,
          'Cannot access files from other users'
        );
      }

      const downloadUrl = await this.s3Service.getPresignedUrlForDownload(fileKey);

      return new ApiResponseDto(true, { downloadUrl, fileKey });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return new ApiResponseDto<DownloadResponseData>(
        false,
        undefined,
        error instanceof Error ? error.message : 'Download URL generation failed'
      );
    }
  }

  @Delete('delete')
  @ApiOperation({ summary: 'Delete file from storage' })
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'File deleted successfully',
    type: ApiResponseDto<DeleteResponseData>,
  })
  @SwaggerApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request or file not found',
  })
  async deleteFile(
    @Req() req: RequestWithUser,
    @Body() dto: UnifiedDeleteDto
  ): Promise<ApiResponseDto<DeleteResponseData>> {
    try {
      const userId = req.user!.id;
      const { path, filename } = dto;

      // Validate and construct the file key
      const fileKey = this.s3Service.validateAndConstructPath(path, filename, userId);

      // For seed operations, we skip ownership verification
      if (fileKey.startsWith('seeds/')) {
        // Add logging for seed operations to track them separately if needed
        console.log(`Seed delete operation: ${fileKey} for user ${userId}`);
      } else if (!fileKey.startsWith(`users/${userId}/`)) {
        return new ApiResponseDto<DeleteResponseData>(
          false,
          undefined,
          'Cannot delete files from other users'
        );
      }

      // Check if file exists first
      const fileExists = await this.s3Service.fileExists(fileKey);
      if (!fileExists) {
        return new ApiResponseDto<DeleteResponseData>(false, undefined, 'File does not exist');
      }

      // Attempt to delete the file
      await this.s3Service.deleteObject(fileKey);

      return new ApiResponseDto(true, { message: 'File deleted successfully' });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      return new ApiResponseDto<DeleteResponseData>(
        false,
        undefined,
        error instanceof Error ? error.message : 'Delete failed'
      );
    }
  }
}
