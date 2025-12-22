import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UnifiedDownloadDto {
  @ApiProperty({
    description: 'Path where file is stored (e.g., media/images)',
    example: 'media/images',
  })
  @IsString()
  path!: string;

  @ApiProperty({
    description: 'Filename to download',
    example: 'photo.jpg',
  })
  @IsString()
  filename!: string;
}
