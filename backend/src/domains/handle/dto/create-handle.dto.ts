// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/create-handle.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class CreateHandleDto {
  @ApiProperty({
    description: 'Type of handle',
    enum: ['account'],
    example: 'account',
  })
  @IsNotEmpty()
  @IsEnum(['account'])
  type!: 'account';
}
