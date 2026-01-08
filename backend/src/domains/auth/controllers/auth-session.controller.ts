import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { CurrentUser } from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';

// Define interface for request with cookies
interface RequestWithCookies {
  ip?: string;
  cookies?: {
    [key: string]: string;
  };
  url: string;
}

// Define interface for response with cookie methods
interface ResponseWithCookies {
  cookie(name: string, value: any, options?: any): this;
  clearCookie(name: string, options?: any): this;
  status(code: number): this;
  json(body: any): this;
  send(body: any): this;
}

@ApiTags('auth')
@Controller('auth')
export class AuthSessionController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register new identity' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Identity registered and session created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid public key format' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiResponse({
    status: 200,
    description: 'Registration successful',
    type: ApiResponseDto<{ userId: string }>,
  })
  async register(
    @Body() loginDto: LoginDto,
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: ResponseWithCookies
  ) {
    const { publicKey, deviceId, deviceModel } = loginDto;
    const ipAddress = req.ip || 'unknown';

    const result = await this.authService.registerIdentity(
      publicKey,
      deviceId,
      deviceModel,
      ipAddress
    );

    // Set HttpOnly cookies for security
    res.cookie('access_token', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: 'strict',
    });

    res.cookie('refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 1000, // 30 days
      sameSite: 'strict',
    });

    return new ApiResponseDto(true, { userId: result.session.identityId });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with public key' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: ApiResponseDto<{ userId: string }>,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: ResponseWithCookies
  ) {
    const { publicKey, deviceId, deviceModel } = loginDto;
    const ipAddress = req.ip || 'unknown';

    const result = await this.authService.loginWithPublicKey(
      publicKey,
      deviceId,
      deviceModel,
      ipAddress
    );

    // Set HttpOnly cookies for security
    res.cookie('access_token', result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: 'strict',
    });

    res.cookie('refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 1000, // 30 days
      sameSite: 'strict',
    });

    return new ApiResponseDto(true, { userId: result.session.identityId });
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully', type: ApiResponseDto })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.authService.getIdentityProfile(user.id);
    return new ApiResponseDto(true, profile);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  @ApiResponse({
    status: 200,
    description: 'Sessions retrieved successfully',
    type: ApiResponseDto<{ sessions: any[] }>,
  })
  async getSessions(@CurrentUser() user: any) {
    const sessions = await this.authService.getIdentitySessions(user.id, user.sessionId);
    return new ApiResponseDto(true, { sessions });
  }

  @Post('sessions/revoke/:id')
  @ApiOperation({ summary: 'Revoke a specific session (except current)' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  @ApiResponse({ status: 200, description: 'Session revoked successfully', type: ApiResponseDto })
  async revokeSession(@CurrentUser() user: any, @Req() req: RequestWithCookies) {
    const sessionId = req.url.split('/').pop(); // Get the session ID from URL
    if (!sessionId) {
      throw new Error('Session ID not provided');
    }

    await this.authService.revokeSessionById(user.id, sessionId, user.sessionId);
    return new ApiResponseDto(true);
  }

  @Post('sessions/revoke-all')
  @ApiOperation({ summary: 'Revoke all other sessions' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'All other sessions revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  @ApiResponse({
    status: 200,
    description: 'All other sessions revoked successfully',
    type: ApiResponseDto,
  })
  async revokeAllOtherSessions(@CurrentUser() user: any) {
    await this.authService.revokeAllSessions(user.id, user.sessionId);
    return new ApiResponseDto(true);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  @ApiResponse({ status: 200, description: 'Logged out successfully', type: ApiResponseDto })
  async logout(@CurrentUser() user: any, @Res({ passthrough: true }) res: ResponseWithCookies) {
    await this.authService.logout(user.id, user.sessionId);

    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    return new ApiResponseDto(true);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: ApiResponseDto<{ userId: string }>,
  })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: ResponseWithCookies
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }

    const ipAddress = req.ip || 'unknown';
    const result = await this.authService.refreshTokens(refreshToken, ipAddress);

    // Set new HttpOnly cookies
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: 'strict',
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 1000, // 30 days
      sameSite: 'strict',
    });

    return new ApiResponseDto(true, { userId: result.identity.id });
  }
}
