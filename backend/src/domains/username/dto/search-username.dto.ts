import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SearchUsernameDto {
  @IsNotEmpty()
  @IsString()
  @Length(5, 32)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;
}
