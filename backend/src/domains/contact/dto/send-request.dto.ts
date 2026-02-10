import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendRequestDto {
  @IsUUID()
  toHandleId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
