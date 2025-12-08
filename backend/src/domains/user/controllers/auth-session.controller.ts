import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Get,
  Param,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';
import { UseGuards } from '@nestjs/common';
import { SessionService } from '../services/session.service';
import { JwtSessionGuard } from '../guards/jwt-session.guard';
import { UserService } from '../services/user.service';
import { RefreshDto } from '../dto/refresh.dto';
import { StorageService } from '../../storage/storage.service';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthSessionController {
  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private userService: UserService,
    private storageService: StorageService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    // ✅ Исправлено: socket вместо connection
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;

    const { tokens } = await this.authService.loginWithPublicKey(
      loginDto.publicKey,
      loginDto.deviceId,
      loginDto.deviceModel,
      ipAddress
    );

    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000,
    });

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { success: true };
  }

  @Post('logout')
  @UseGuards(JwtSessionGuard) // ← защищённый маршрут
  @ApiSecurity('access-token-cookie') // ← имя из addSecurity
  @ApiOperation({ summary: 'End of current session, logout' })
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const { id: userId, sessionId } = req.user;

    // Отзываем сессию в БД
    await this.sessionService.revokeSession(userId, sessionId);

    // Удаляем куки
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return { success: true };
  }

  @Get('profile')
  @UseGuards(JwtSessionGuard)
  @ApiSecurity('access-token-cookie') // ← имя из addSecurity
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: Request) {
    const user = await this.userService.getProfileByUserId(req.user!.id);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check for avatar existence and generate presigned URL
    let avatarUrl: string | null = null;
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];
    
    for (const ext of extensions) {
      const key = `users/${user.id}/avatar.${ext}`;
      if (await this.storageService.fileExists(key)) {
        avatarUrl = await this.storageService.getPresignedUrlForDownload(key);
        break;
      }
    }

    return {
      id: user.id,
      publicKey: user.publicKey.toString('base64'),
      displayName: user.displayName,
      username: user.username?.username,
      avatarUrl,
    };
  }

  @Get('sessions')
  @UseGuards(JwtSessionGuard)
  @ApiSecurity('access-token-cookie') // ← имя из addSecurity
  @ApiOperation({ summary: 'List of active sessions' })
  async getSessions(@Req() req: Request) {
    const sessions = await this.sessionService.findActiveSessionsByUserId(
      req.user!.id,
      req.user!.sessionId
    );

    return { sessions };
  }

  @Post('sessions/revoke/:id')
  @UseGuards(JwtSessionGuard)
  @ApiSecurity('access-token-cookie') // ← имя из addSecurity
  @ApiOperation({ summary: 'revoke active session (but not current)' })
  async revokeSession(@Req() req: Request, @Param('id', new ParseUUIDPipe()) sessionId: string) {
    await this.sessionService.revokeSessionById(
      req.user!.id,
      sessionId,
      req.user!.sessionId // ← передаём текущий ID
    );
    return { success: true };
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtSessionGuard)
  @ApiSecurity('access-token-cookie')
  @ApiOperation({ summary: 'Close all other sessions except current' })
  @HttpCode(HttpStatus.OK)
  async revokeAllOtherSessions(@Req() req: Request) {
    await this.sessionService.revokeAllSessions(req.user!.id, req.user!.sessionId);
    return { success: true };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access and refresh tokens' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async refresh(
    @Body() refreshDto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress || undefined;
    const { accessToken, refreshToken } = await this.sessionService.refreshSession(
      refreshDto.refreshToken,
      ipAddress
    );

    // Устанавливаем новые куки
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000,
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { success: true };
  }

  @Get('user/:id/public-key')
  @ApiOperation({ summary: 'Get user public key (for debugging)' })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { publicKey: { type: 'string' } } },
  })
  async getUserPublicKey(@Param('id') userId: string) {
    const publicKey = await this.userService.getUserPublicKeyBase64(userId);
    if (!publicKey) {
      throw new NotFoundException('User not found');
    }
    return { publicKey };
  }
}
