import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UnifiedUploadDto {
  @ApiProperty({
    description: 'Content type (MIME type)',
    example: 'image/jpeg',
  })
  @IsString()
  contentType!: string;

  @ApiProperty({
    description: 'Path where file should be stored (e.g., media/images)',
    example: 'media/images',
  })
  @IsString()
  path!: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'photo.jpg',
  })
  @IsString()
  @MaxLength(25)
  filename!: string;

  @ApiProperty({
    description: 'File type (optional)',
    enum: ['avatar', 'image', 'video', 'audio', 'document', 'seed'],
    example: 'image',
    required: false,
  })
  @IsString()
  @IsOptional()
  fileType?: string;
}
