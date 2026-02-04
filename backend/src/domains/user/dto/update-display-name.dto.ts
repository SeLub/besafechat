import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDisplayNameDto {
  @ApiProperty({
    description: 'Display name (1-24 characters, supports Unicode and emoji)',
    example: 'Sergio Boffon 🔐',
    minLength: 1,
    maxLength: 24,
  })
  @IsString()
  @Length(1, 24)
  displayName!: string;
}
