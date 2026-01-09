// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/dto/check-alias-availability.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CheckAliasAvailabilityDto {
  @ApiProperty({
    description: 'The alias to check for availability',
    example: 'john-doe',
    minLength: 1,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  alias!: string;
}
