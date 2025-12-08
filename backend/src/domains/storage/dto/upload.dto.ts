import { IsString, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadDto {
  @ApiProperty({
    description: 'File type',
    enum: ['avatar', 'image', 'video', 'audio', 'document'],
    example: 'avatar',
  })
  @IsString()
  @IsIn(['avatar', 'image', 'video', 'audio', 'document'])
  fileType!: string;

  @ApiProperty({
    description: 'Content type (MIME type)',
    example: 'image/jpeg',
  })
  @IsString()
  contentType!: string;

  @ApiProperty({
    description: 'Original filename (optional, for non-avatar files)',
    example: 'photo.jpg',
    required: false,
  })
  @IsString()
  @IsOptional()
  filename?: string;
}
