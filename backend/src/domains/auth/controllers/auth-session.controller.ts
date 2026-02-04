// /home/selub/Documents/progs/besafechat/backend/src/domains/auth/controllers/auth-session.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../../common/types/authenticated-request';
import { ResponseWithCookies } from '../../../common/types/response-with-cookies';
import { RedisService } from '../../../domains/redis/redis.service';
import { MessagesGateway } from '../../message/gateways/messages.gateway';
import {
  CurrentIdentity,
  CurrentSession,
  CurrentUser,
} from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { SessionService } from '../../session/services/session.service';
import { CreateChallengeDto, ValidateChallengeDto } from '../dto/challenge.dto';
import { AuthService } from '../services/auth.service';
import { ChallengeService } from '../services/challenge.service';

@ApiTags('auth')
@Controller('auth')
export class AuthSessionController {
  constructor(
    private authService: AuthService,
    private challengeService: ChallengeService,
    private redisService: RedisService,
    private messagesGateway: MessagesGateway,
    private sessionService: SessionService
  ) {}

  @Post('login/challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a challenge for login authentication' })
  @ApiBody({ type: CreateChallengeDto })
  @ApiResponse({ status: 200, description: 'Challenge created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async requestLoginChallenge(
    @Body() createChallengeDto: CreateChallengeDto,
    @Req() req: AuthenticatedRequest
  ) {
    const { publicKey, action } = createChallengeDto;
    const ipAddress = req.ip || 'unknown';

    if (action !== 'login') {
      throw new BadRequestException('Action must be "login" for this endpoint');
    }

    const challengeResult = await this.challengeService.createChallenge(
      publicKey,
      action,
      ipAddress
    );

    return new ApiResponseDto(true, challengeResult);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with challenge-response authentication' })
  @ApiBody({ type: ValidateChallengeDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async loginWithChallenge(
    @Body() validateChallengeDto: ValidateChallengeDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: ResponseWithCookies
  ) {
    const { challengeId, publicKey, signature, deviceName } = validateChallengeDto;
    const ipAddress = req.ip || 'unknown';

    // Validate the challenge-response
    const isValid = await this.challengeService.validateChallenge(
      challengeId,
      publicKey,
      signature,
      ipAddress
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid challenge response');
    }

    // Perform login - this will create session if identity exists or create new one if first login
    const result = await this.authService.loginWithPublicKey(
      publicKey,
      deviceName || 'Unknown device',
      undefined, // deviceType
      ipAddress,
      undefined // userAgent - will be obtained from the actual request object
    );

    // Set HttpOnly cookies for security
    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    return new ApiResponseDto(true, {
      identityId: result.identity.id,
      sessionId: result.session.id,
      hasHandle: result.session.activeHandleId !== null,
    });
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile with handle and identity info' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  async getProfile(@CurrentIdentity() identity: any) {
    const profile = await this.authService.getIdentityProfile(identity.id);
    return new ApiResponseDto(true, profile);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  async getSessions(@CurrentUser() user: AuthenticatedUser) {
    const sessions = await this.authService.getIdentitySessions(user.identityId, user.sessionId);
    return new ApiResponseDto(true, { sessions });
  }

  @Post('sessions/revoke/:id')
  @ApiOperation({ summary: 'Revoke a specific session (except current)' })
  @ApiCookieAuth()
  @ApiParam({
    name: 'id',
    description: 'Session ID to revoke',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  @ApiResponse({ status: 200, description: 'Session revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param('id') sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException('Session ID not provided');
    }

    await this.authService.revokeSessionById(user.identityId, sessionId, user.sessionId);
    return new ApiResponseDto(true);
  }

  @Post('sessions/revoke-all')
  @ApiOperation({ summary: 'Revoke all other sessions' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'All other sessions revoked successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  async revokeAllOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.revokeAllSessions(user.identityId, user.sessionId);
    return new ApiResponseDto(true);
  }

  @Post('switch-handle')
  @ApiOperation({ summary: 'Switch active handle in current session' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Handle switched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  @ApiBody({ schema: { properties: { handleId: { type: 'string' } } } })
  async switchHandle(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentSession() session: any,
    @Body('handleId') handleId: string
  ) {
    if (!handleId) {
      throw new BadRequestException('Handle ID is required');
    }

    const updatedSession = await this.authService.switchActiveHandle(
      user.identityId,
      session.id,
      handleId
    );

    return new ApiResponseDto(true, {
      message: 'Handle switched successfully',
      activeHandleId: updatedSession.activeHandleId,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtSessionGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: ResponseWithCookies
  ) {
    // Get the active handle ID for this session to clear the correct online status
    const session = await this.sessionService.getSessionById(user.sessionId);
    const handleId = session?.activeHandleId;

    await this.authService.logout(user.identityId, user.sessionId);

    // Clear online status from Redis if handleId exists
    if (handleId) {
      const redis = this.redisService.getClient();
      await redis.del(`online:${handleId}`);

      // Notify other users that this handle has gone offline
      await this.messagesGateway.notifyContactsUserOffline(handleId);
    }

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
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: ResponseWithCookies
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token not found');
    }

    const ipAddress = req.ip || 'unknown';
    const result = await this.authService.refreshTokens(refreshToken, ipAddress);

    // Set new HttpOnly cookies
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return new ApiResponseDto(true, {
      identityId: result.identity?.id,
      activeHandleId: result.activeHandle?.id,
    });
  }

  private setAuthCookies(res: ResponseWithCookies, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: 'strict',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      sameSite: 'strict',
    });
  }
}
