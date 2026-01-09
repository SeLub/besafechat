import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Base64-encoded Ed25519 public key (44 characters)',
    example: 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=',
    minLength: 44,
    maxLength: 44,
  })
  @IsNotEmpty()
  @IsString()
  @Length(44, 44)
  publicKey!: string;

  @ApiProperty({
    description: 'Device name for display',
    example: 'iPhone 13 Pro',
    minLength: 1,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  deviceName!: string;

  @ApiProperty({
    description: 'Device type: mobile, desktop, or web',
    example: 'mobile',
    enum: ['mobile', 'desktop', 'web'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^(mobile|desktop|web)$/, {
    message: 'Device type must be mobile, desktop, or web',
  })
  deviceType?: string;

  @ApiProperty({
    description: 'Optional user agent string',
    example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    required: false,
  })
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class RegisterWithHandleDto extends LoginDto {
  @ApiProperty({
    description:
      'Handle/username for registration (will be generated from public key hash if not provided)',
    example: 'user_V1StGXR8_Z5jdHi6B-myT',
    minLength: 3,
    maxLength: 32,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Handle can only contain letters, digits, dots, hyphens and underscores',
  })
  handle!: string;

  @ApiProperty({
    description: 'Display name for profile',
    example: 'Anonym User',
    minLength: 1,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  displayName!: string;

  @ApiProperty({
    description: 'Whether the handle is searchable',
    example: 'yes',
    enum: ['yes', 'no'],
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(yes|no)$/, { message: 'isSearchable must be "yes" or "no"' })
  isSearchable!: string;
}
