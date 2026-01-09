// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/update-handle.dto.ts
import { IsOptional, IsString, IsBoolean, Length, Matches } from 'class-validator';

export class UpdateHandleDto {
  @IsOptional()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-zA-Z0-9_\-\s]+$/, {
    message: 'Alias can only contain letters, digits, spaces, hyphens and underscores',
  })
  alias?: string | null; // Разрешаем null

  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
