// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/dto/update-settings.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({
    description: 'Whether to show email publicly',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @ApiProperty({
    description: 'Whether to show phone publicly',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;

  @ApiProperty({
    description: 'Whether to show presence status',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showPresence?: boolean;

  @ApiProperty({
    description: 'Whether to show last seen time',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  showLastSeen?: boolean;

  @ApiProperty({
    description: 'Additional settings',
    example: { notifications: { messages: true } },
    required: false,
  })
  @IsOptional()
  @IsObject()
  additionalSettings?: Record<string, any>; // Исправлено: именованное поле вместо индексной сигнатуры
}
