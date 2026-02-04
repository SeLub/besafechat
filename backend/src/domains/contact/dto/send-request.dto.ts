import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendRequestDto {
  @IsUUID()
  toUserId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
