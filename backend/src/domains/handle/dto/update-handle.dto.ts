// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/update-handle.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, Length, Matches } from 'class-validator';

export class UpdateHandleDto {
  @ApiPropertyOptional({
    description: 'Optional alias for the handle',
    example: 'Johnny',
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-zA-Z0-9_\-\s]+$/, {
    message: 'Alias can only contain letters, digits, spaces, hyphens and underscores',
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
