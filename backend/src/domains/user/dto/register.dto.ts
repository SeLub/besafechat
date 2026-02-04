import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsDtoBe64 } from 'src/common/validators/is-dto-be64.validator';

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
    description: 'Display name for the user',
    example: 'Alice',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  displayName?: string;
}
