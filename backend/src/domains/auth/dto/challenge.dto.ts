import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateChallengeDto {
  @ApiProperty({
    description: 'Public key in base64 format',
    example: 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=',
  })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @ApiProperty({
    description: 'Action type for the challenge',
    enum: ['register', 'login'],
    example: 'login',
  })
  @IsEnum(['register', 'login'])
  action!: 'register' | 'login';
}

export class ValidateChallengeDto {
  @ApiProperty({
    description: 'Challenge ID returned from the challenge request',
    example: 'a1b2c3d4e5f678901234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32) // hex representation of 16 bytes
  challengeId!: string;

  @ApiProperty({
    description: 'Public key in base64 format',
    example: 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=',
  })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @ApiProperty({
    description: 'Ed25519 signature of the challenge in base64 format',
    example:
      'MEUCIQDd5JQ6mkY4ciZjC6rJCdzr5D2L6JeYTcOE2CaY0GLV0wIgGz7VZsWSaaznfHp5AJKr33Jp80Cs6LpJ0pwT0L8Y4CY=',
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;

  @ApiProperty({
    description: 'Device ID (optional)',
    example: 'device-123',
  })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({
    description: 'Device name (optional)',
    example: 'Chrome on Windows',
  })
  @IsString()
  @IsOptional()
  deviceName?: string;
}
