// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/create-handle.dto.ts
import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'The handle value',
    example: 'john_doe',
    minLength: 3,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 255)
  @Matches(/^[a-z0-9_.-]+$/, {
    message: 'Handle can only contain lowercase letters, digits, dots, hyphens and underscores',
  })
  value!: string;

  @ApiProperty({
    description: 'Type of handle',
    enum: ['account', 'team', 'channel'],
    example: 'account',
  })
  @IsNotEmpty()
  @IsEnum(['account', 'team', 'channel'])
  type!: HandleType;

  @ApiProperty({
    description: 'Optional alias for the handle',
    example: 'John Doe',
    required: false,
    minLength: 1,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  alias?: string;

  @ApiProperty({
    description: 'Whether the handle is searchable',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiProperty({
    description: 'Whether this is the primary handle',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
