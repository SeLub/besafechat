// /home/selub/Documents/progs/besafechat/backend/src/domains/profile/controllers/profile.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Delete,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Query,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import {
  CurrentUser,
  CurrentHandle,
  CurrentIdentity,
} from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { ProfileService } from '../services/profile.service';
import { CreateProfileDto } from '../dto/create-profile.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UpdateSettingsDto } from '../dto/update-settings.dto';
import { HandleService } from '../../handle/services/handle.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private handleService: HandleService
  ) {}

  @Post()
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Create profile for current handle' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiBody({ type: CreateProfileDto })
  async createProfile(@CurrentHandle() handle: any, @Body() dto: CreateProfileDto) {
    // Проверяем что handle типа 'account'
    if (handle.type !== 'account') {
      throw new BadRequestException('Profile can only be created for account handles');
    }

    const profile = await this.profileService.createProfile({
      handleId: handle.id,
      ...dto,
    });

    return new ApiResponseDto(true, {
      message: 'Profile created successfully',
      profile,
    });
  }

  @Get('me')
  @UseGuards(JwtSessionGuard)
  @ApiOperation({ summary: 'Get profile for current active handle' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  async getMyProfile(@CurrentHandle() handle: any) {
    const profile = await this.profileService.getProfileByHandle(handle.id);
    return new ApiResponseDto(true, { profile });
  }

  @Get('public/:handle')
  @ApiOperation({ summary: 'Get public profile by handle value' })
  @ApiParam({ name: 'handle', description: 'Handle value (username)', example: 'john_doe' })
  async getPublicProfile(@Param('handle') handleValue: string) {
    const profile = await this.profileService.getPublicProfile(handleValue);
    return new ApiResponseDto(true, { profile });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search public profiles' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({ name: 'limit', description: 'Maximum results', required: false, type: Number })
  async searchProfiles(@Query('q') query: string, @Query('limit') limit?: number) {
    const profiles = await this.profileService.searchProfiles(
      query,
      limit ? parseInt(limit.toString()) : 20
    );

    // Фильтруем приватные данные для публичного поиска
    const publicProfiles = profiles.map((profile) => ({
      handle: {
        value: profile.handle.value,
        alias: profile.handle.alias,
      },
      displayName: profile.displayName,
      avatarUrl: (profile as any).avatarUrl, // Already computed by ProfileService
      bio: profile.bio,
      createdAt: profile.createdAt,
    }));

    return new ApiResponseDto(true, { profiles: publicProfiles });
  }

  @Put()
  @UseGuards(JwtSessionGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update profile for current active handle' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiBody({ type: UpdateProfileDto })
  async updateMyProfile(@CurrentHandle() handle: any, @Body() dto: UpdateProfileDto) {
    const updatedProfile = await this.profileService.updateProfile(handle.id, dto);
    return new ApiResponseDto(true, {
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });
  }

  @Put('settings')
  @UseGuards(JwtSessionGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Update profile settings' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiBody({ type: UpdateSettingsDto })
  async updateSettings(@CurrentHandle() handle: any, @Body() dto: UpdateSettingsDto) {
    const updatedProfile = await this.profileService.updateSettings(handle.id, dto);
    return new ApiResponseDto(true, {
      message: 'Settings updated successfully',
      settings: updatedProfile.settings,
    });
  }

  @Put('bio')
  @UseGuards(JwtSessionGuard)
  @ApiOperation({ summary: 'Update profile bio' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  @ApiBody({ schema: { properties: { bio: { type: 'string' } } } })
  async updateBio(@CurrentHandle() handle: any, @Body('bio') bio: string) {
    const updatedProfile = await this.profileService.updateBio(handle.id, bio);
    return new ApiResponseDto(true, {
      message: 'Bio updated successfully',
      bio: updatedProfile.bio,
    });
  }

  @Get('by-identity')
  @UseGuards(JwtSessionGuard)
  @ApiOperation({ summary: 'Get all profiles for current identity (all handles)' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  async getIdentityProfiles(@CurrentIdentity() identity: any) {
    // Получаем все handle пользователя
    const handles = await this.handleService.getHandlesByIdentity(identity.id);

    // Получаем профили для всех handle
    const profiles = await Promise.all(
      handles.map(async (handle) => {
        try {
          const profile = await this.profileService.getProfileByHandle(handle.id);
          return {
            handle: {
              id: handle.id,
              value: handle.value,
              alias: handle.alias,
              isPrimary: handle.isPrimary,
              type: handle.type,
            },
            profile,
          };
        } catch (error) {
          // Если профиль не найден, возвращаем только handle
          return {
            handle: {
              id: handle.id,
              value: handle.value,
              alias: handle.alias,
              isPrimary: handle.isPrimary,
              type: handle.type,
            },
            profile: null,
          };
        }
      })
    );

    return new ApiResponseDto(true, { profiles });
  }

  @Delete()
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete profile for current active handle' })
  @ApiBearerAuth()
  @ApiCookieAuth()
  async deleteMyProfile(@CurrentHandle() handle: any) {
    await this.profileService.deleteProfile(handle.id);
    return new ApiResponseDto(true, { message: 'Profile deleted successfully' });
  }

  @Get(':handleId')
  @ApiOperation({ summary: 'Get profile by handle ID (admin/private)' })
  @ApiParam({
    name: 'handleId',
    description: 'Handle ID',
    type: String,
    example: 'abc123-def456-ghi789'
  })
  @UseGuards(JwtSessionGuard)
  @ApiBearerAuth()
  @ApiCookieAuth()
  async getProfileByHandleId(
    @Param('handleId', ParseUUIDPipe) handleId: string,
    @CurrentIdentity() identity: any
  ) {
    // Проверяем что handle принадлежит пользователю
    const handle = await this.handleService.findById(handleId);

    if (!handle || handle.ownerIdentityId !== identity.id) {
      throw new NotFoundException('Profile not found');
    }

    const profile = await this.profileService.getProfileByHandle(handleId);
    return new ApiResponseDto(true, { profile });
  }
}
