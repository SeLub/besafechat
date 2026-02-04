// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/set-username.dto.ts
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SetUsernameDto {
  @IsNotEmpty()
  @IsString()
  @Length(5, 32, { message: 'Username must be between 5 and 32 characters' })
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Username can only contain lowercase letters, digits, and underscores',
  })
  username!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^(yes|no)$/, { message: 'isSearchable must be "yes" or "no"' })
  isSearchable!: string;
}
