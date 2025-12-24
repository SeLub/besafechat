import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest, NestResponse } from '../../../common/types/authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async register(
    @Body() registerDto: RegisterDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: NestResponse
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress || undefined;
    const { user, tokens } = await this.authService.register(
      registerDto.publicKey,
      registerDto.deviceId,
      registerDto.deviceModel,
      ipAddress
    );

    // Set cookies for automatic authentication
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 1000, // 30 days
    });

    return {
      success: true,
      data: {
        userId: user.id,
        message: 'User registered successfully',
      },
    };
  }
}
