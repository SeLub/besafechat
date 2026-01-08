import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { CurrentUser } from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { HandleService } from '../services/handle.service';
import { SetUsernameDto } from '../dto/set-username.dto';
import { AuthenticatedRequest } from '../../../common/types/authenticated-request';

@ApiTags('handle')
@Controller('username')
export class HandleController {
  constructor(private handleService: HandleService) {}

  @Get('search/:username')
  @ApiOperation({ summary: 'Check if username is available or get user info if exists' })
  @ApiParam({ name: 'username', description: 'Username to search for', example: 'john_doe' })
  @ApiResponse({ status: 200, description: 'Username availability checked', type: ApiResponseDto })
  async searchByUsername(@Param('username') username: string) {
    const result = await this.handleService.searchByUsername(username);

    // Return the availability result in a consistent format
    // Instead of throwing 404 when available, return success response
    return new ApiResponseDto(true, result);
  }

  @Post('set')
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async setUsername(@Req() req: AuthenticatedRequest, @Body() dto: SetUsernameDto) {
    const isSearchable = dto.isSearchable === 'yes';
    await this.handleService.setUsername(req.user!.id, dto.username, isSearchable);
    return { success: true, message: 'Username updated successfully' };
  }
}
