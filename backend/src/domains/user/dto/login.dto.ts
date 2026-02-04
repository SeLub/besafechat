import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
    description: 'Unique device identifier',
    example: 'desktop-chrome-123',
    minLength: 1,
    maxLength: 64,
  })
  @IsNotEmpty()
  @IsString()
  deviceId!: string;

  @ApiProperty({
    description: 'Optional device model for UI',
    example: 'Chrome on Linux',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceModel?: string;
}
