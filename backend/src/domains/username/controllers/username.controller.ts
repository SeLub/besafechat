import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { SetUsernameDto } from '../dto/set-username.dto';
import { UsernameService } from '../services/username.service';
import { JwtSessionGuard } from '../../user/guards/jwt-session.guard';

// Define interface for request with user property
interface RequestWithUser {
  user?: {
    id: string;
    sessionId: string;
    publicKey: Buffer;
  };
}

@Controller('username')
export class UsernameController {
  constructor(private usernameService: UsernameService) {}

  @Post('set')
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async setUsername(@Req() req: RequestWithUser, @Body() dto: SetUsernameDto) {
    const isSearchable = dto.isSearchable === 'yes';
    await this.usernameService.setUsername(req.user!.id, dto.username, isSearchable);
    return { success: true, message: 'Username updated successfully' };
  }

  @Get('search/:username')
  async search(@Param('username') username: string) {
    const user = await this.usernameService.findUserByUsername(username);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return {
      id: user.id,
      publicKey: user.publicKey,
      displayName: user.displayName,
    };
  }
}
