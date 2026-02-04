import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({
    description: 'Active refresh token (64-character hex string)',
    example: 'a1b2c3d4e5f6... (64 chars)',
    minLength: 64,
    maxLength: 128,
  })
  @IsNotEmpty()
  @IsString()
  refreshToken!: string;
}
