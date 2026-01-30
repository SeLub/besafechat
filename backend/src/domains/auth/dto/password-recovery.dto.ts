import { IsOptional, IsString, Length } from 'class-validator';

export class CheckPasswordAvailabilityDto {
  @IsString()
  @Length(64, 64) // SHA256 hex
  password_hash!: string;

  @IsOptional()
  @IsString()
  client_nonce?: string; // For preventing replay attacks
}

export class ClaimPasswordDto {
  @IsString()
  @Length(64, 64)
  password_hash!: string;

  @IsOptional()
  @IsString()
  user_agent?: string;
}
