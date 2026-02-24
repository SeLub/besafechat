// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/dto/update-settings.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsObject, IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UISettingsDto {
  @ApiProperty({
    description: 'User interface theme',
    enum: ['besafe', 'leteem', 'minimal'],
    example: 'besafe',
    required: false,
  })
  @IsOptional()
  @IsEnum(['besafe', 'leteem', 'minimal'])
  theme?: 'besafe' | 'leteem' | 'minimal';

  @ApiProperty({
    description: 'User interface language',
    enum: ['en', 'ru', 'de', 'fr'],
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsEnum(['en', 'ru', 'de', 'fr'])
  language?: 'en' | 'ru' | 'de' | 'fr';

  @ApiProperty({
    description: 'Light or dark mode within the theme',
    enum: ['light', 'dark'],
    example: 'dark',
    required: false,
  })
  @IsOptional()
  @IsEnum(['light', 'dark'])
  mode?: 'light' | 'dark';
}

class StorageSettingsDto {
  @ApiProperty({
    description: 'Message retention period in days',
    enum: ['7', '30', '90', 'forever'],
    example: 'forever',
    required: false,
  })
  @IsOptional()
  @IsEnum(['7', '30', '90', 'forever'])
  messageRetentionDays?: '7' | '30' | '90' | 'forever';
}

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'UI settings (theme, language)',
    type: UISettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UISettingsDto)
  ui?: UISettingsDto;

  @ApiProperty({
    description: 'Storage settings (message retention)',
    type: StorageSettingsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => StorageSettingsDto)
  storage?: StorageSettingsDto;

  @ApiProperty({
    description: 'Enable/disable all notifications',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @ApiProperty({
    description: 'Enable/disable sound effects',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  sound?: boolean;
}
