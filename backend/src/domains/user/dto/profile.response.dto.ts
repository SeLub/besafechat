import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ProfileResponseDto {
  @ApiProperty({
    example: '7abb74ba-22bf-41c5-a2ed-618528a5e2ab',
  })
  id!: string;

  @ApiProperty({
    description: 'Base64-encoded public key',
    example: 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=',
  })
  publicKey!: string;

  @ApiProperty({
    description: 'Optional display name',
    example: 'Alice',
    required: false,
  })
  @IsOptional()
  @IsString()
  displayName?: string;
}
