// /home/selub/Documents/progs/besafechat/backend/src/domains/handle/controllers/handle.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { CurrentIdentity } from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { CreateHandleDto } from '../dto/create-handle.dto';
import { Handle } from '../handle.entity';
import { HandleService } from '../services/handle.service';

@ApiTags('handles')
@Controller('handles')
@UseGuards(JwtSessionGuard)
@ApiBearerAuth()
export class HandleController {
  constructor(private handleService: HandleService) {}

  @Get('alias/check/:alias')
  @ApiOperation({ summary: 'Check if a handle name (value or alias) is available' })
  @ApiParam({
    name: 'alias',
    description: 'Handle name to check (checks both value and alias fields)',
    example: 'john-doe',
    type: String,
  })
  @ApiResponse({ status: 200, description: 'Handle availability checked', type: ApiResponseDto })
  async checkAliasAvailability(@Param('alias') alias: string) {
    const result = await this.handleService.checkAliasAvailability(alias);
    return new ApiResponseDto(true, result);
  }

  @Get()
  @ApiOperation({ summary: 'Get all handles for current identity' })
  @ApiResponse({ status: 200, description: 'List of handles', type: [Handle] })
  async getMyHandles(@CurrentIdentity() identity: any) {
    console.log('[HandleController] GET /handles - identity:', identity?.id);
    try {
      const handles = await this.handleService.getHandlesByIdentity(identity.id);
      console.log('[HandleController] GET /handles - found handles:', handles.length);
      return new ApiResponseDto(true, { handles });
    } catch (error) {
      console.error('[HandleController] GET /handles - error:', error);
      throw error;
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Create a new handle. Profile is created automatically for account-type handles.' })
  @ApiBody({ type: CreateHandleDto })
  async createHandle(@CurrentIdentity() identity: any) {
    // Generate unique handle value
    const generatedValue = this.handleService.generateHandleValue();

    const handle = await this.handleService.createHandle({
      value: generatedValue,
      type: 'account',
      ownerIdentityId: identity.id,
      alias: null,
      isSearchable: true,
      isPrimary: false,
      profileData: {
        displayName: 'Anonym User',
      },
    });

    return new ApiResponseDto(true, handle);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search for handles' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
  })
  async searchHandles(@Query('q') query: string, @Query('limit') limit?: number) {
    const handles = await this.handleService.searchHandles(
      query,
      limit ? parseInt(limit.toString()) : 20
    );
    return new ApiResponseDto(true, { handles });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get handle by ID' })
  @ApiParam({ name: 'id', description: 'Handle ID', type: String, example: 'abc123-def456-ghi789' })
  async getHandleById(@Param('id', ParseUUIDPipe) id: string) {
    const handle = await this.handleService.findById(id);
    return new ApiResponseDto(true, { handle });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete handle and return updated list' })
  @ApiParam({ name: 'id', description: 'Handle ID', type: String, example: 'abc123-def456-ghi789' })
  async deleteHandle(@CurrentIdentity() identity: any, @Param('id', ParseUUIDPipe) id: string) {
    // Проверяем что handle принадлежит identity
    const handle = await this.handleService.findById(id);
    if (handle.ownerIdentityId !== identity.id) {
      throw new NotFoundException('Handle not found');
    }

    await this.handleService.deleteHandle(id);

    // Получаем обновленный список handles
    const updatedHandles = await this.handleService.getHandlesByIdentity(identity.id);

    return new ApiResponseDto(true, { handles: updatedHandles });
  }

  @Post(':id/alias')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set or remove alias for handle' })
  @ApiParam({ name: 'id', description: 'Handle ID', type: String, example: 'abc123-def456-ghi789' })
  @ApiBody({ schema: { properties: { alias: { type: 'string', nullable: true } } } })
  async setHandleAlias(
    @CurrentIdentity() identity: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('alias') alias?: string | null
  ) {
    // Проверяем что handle принадлежит identity
    const handle = await this.handleService.findById(id);
    if (handle.ownerIdentityId !== identity.id) {
      throw new NotFoundException('Handle not found');
    }

    const updatedHandle = await this.handleService.setAlias(id, alias);
    return {
      success: true,
      message: alias ? 'Alias set successfully' : 'Alias removed successfully',
      data: updatedHandle,
    };
  }

  @Post(':id/searchable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set handle searchable status' })
  @ApiParam({ name: 'id', description: 'Handle ID', type: String, example: 'abc123-def456-ghi789' })
  @ApiBody({ schema: { properties: { isSearchable: { type: 'boolean' } } } })
  async setHandleSearchable(
    @CurrentIdentity() identity: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('isSearchable') isSearchable: boolean
  ) {
    // Проверяем что handle принадлежит identity
    const handle = await this.handleService.findById(id);
    if (handle.ownerIdentityId !== identity.id) {
      throw new NotFoundException('Handle not found');
    }

    const updatedHandle = await this.handleService.setSearchable(id, isSearchable);
    return {
      success: true,
      message: `Handle is now ${isSearchable ? 'searchable' : 'not searchable'}`,
      data: updatedHandle,
    };
  }

  @Post('primary/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch primary handle' })
  @ApiParam({
    name: 'id',
    description: 'New primary handle ID',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  async switchPrimaryHandle(
    @CurrentIdentity() identity: any,
    @Param('id', ParseUUIDPipe) id: string
  ) {
    const updatedHandle = await this.handleService.switchPrimaryHandle(identity.id, id);
    return {
      success: true,
      message: 'Primary handle switched successfully',
      data: updatedHandle,
    };
  }
}
