// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/update-handle.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, Length, Matches } from 'class-validator';

export class UpdateHandleDto {
  @ApiPropertyOptional({
    description: 'Optional alias for the handle (username-style, like @john-doe)',
    example: 'john-doe',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Alias can only contain lowercase letters, digits, hyphens and underscores',
  })
  alias?: string | null; // Allow null

  @ApiPropertyOptional({
    description: 'Whether the handle is searchable',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this is the primary handle',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
