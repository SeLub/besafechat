import {
  Controller,
  Patch,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtSessionGuard } from '../guards/jwt-session.guard';
import { UserService } from '../services/user.service';
import { UpdateDisplayNameDto } from '../dto/update-display-name.dto';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class ProfileController {
  constructor(private userService: UserService) {}

  @Patch('display-name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update display name' })
  async updateDisplayName(@Req() req: Request, @Body() dto: UpdateDisplayNameDto) {
    const userId = req.user!.id;
    await this.userService.updateDisplayName(userId, dto.displayName);
    return { success: true };
  }
}
