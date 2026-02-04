import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsDtoBe64 } from '../../../common/validators/is-dto-be64.validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Base64-encoded Ed25519 public key',
    example: 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=',
  })
  @IsNotEmpty()
  @IsDtoBe64()
  @Length(44, 44)
  publicKey!: string;

  @ApiProperty({
    description: 'Generated Device ID',
    example: 'web-as77-600x400',
  })
  @IsNotEmpty()
  @IsString()
  deviceId!: string;

  @ApiProperty({
    description: 'Generated Device Name',
    example: '"iPhone 13", "Windows"',
  })
  deviceModel?: string;
}
