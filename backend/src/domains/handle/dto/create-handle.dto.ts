// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/create-handle.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';
import { HandleType } from '../handle.entity';

export class CreateHandleDto {
  @IsNotEmpty()
  @IsString()
  @Length(3, 255)
  @Matches(/^[a-z0-9_.-]+$/, {
    message: 'Handle can only contain lowercase letters, digits, dots, hyphens and underscores',
  })
  value!: string;

  @IsNotEmpty()
  @IsEnum(['account', 'team', 'channel'])
  type!: HandleType;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  alias?: string;

  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
