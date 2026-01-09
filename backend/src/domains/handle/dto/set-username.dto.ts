// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/set-username.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SetUsernameDto {
  @ApiProperty({
    description: 'Desired username',
    example: 'john_doe',
    minLength: 5,
    maxLength: 32,
  })
  @IsNotEmpty()
  @IsString()
  @Length(5, 32, { message: 'Username must be between 5 and 32 characters' })
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Username can only contain lowercase letters, digits, and underscores',
  })
  username!: string;

  @ApiProperty({
    description: 'Whether the handle should be searchable',
    example: 'yes',
    enum: ['yes', 'no'],
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^(yes|no)$/, { message: 'isSearchable must be "yes" or "no"' })
  isSearchable!: string;
}
