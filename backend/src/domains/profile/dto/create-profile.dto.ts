// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/dto/create-profile.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEmail,
  Length,
  IsObject,
  ValidateIf,
} from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({
    description: 'Display name (required)',
    example: 'John Doe',
    minLength: 1,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  displayName!: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  firstName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  lastName?: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john@example.com',
    required: false,
  })
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== undefined && o.email !== null)
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number (international format or local)',
    example: '+1234567890',
    required: false,
    minLength: 7,
    maxLength: 20,
  })
  @IsOptional()
  @ValidateIf((o) => o.phone !== '' && o.phone !== undefined && o.phone !== null)
  @IsString()
  @Length(7, 20)
  phone?: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiProperty({
    description: 'Bio/description',
    example: 'Software developer and open source enthusiast',
    required: false,
    maxLength: 256,
  })
  @IsOptional()
  @IsString()
  @Length(0, 256)
  bio?: string;

  @ApiProperty({
    description: 'Profile settings',
    example: { showEmail: false, showPhone: true },
    required: false,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
