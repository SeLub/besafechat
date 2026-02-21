import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { CurrentIdentity } from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { IdentityService } from '../services/identity.service';

@ApiTags('identities')
@Controller('identities')
export class IdentityController {
  constructor(private identityService: IdentityService) {}

  @Delete('me')
  @UseGuards(JwtSessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete current identity (start 90-day recovery window)',
    description:
      'Marks identity and all related data as deleted. User can recover within 90 days by logging in with seed phrase.',
  })
  @ApiCookieAuth()
  @ApiResponse({
    status: 200,
    description: 'Account deletion initiated (90-day recovery window active)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Account marked for deletion. You have 90 days to recover.',
            },
            recoveryDeadline: {
              type: 'string',
              format: 'date-time',
              example: '2026-05-22T14:30:00Z',
            },
          },
        },
      },
    },
  })
  async deleteMyIdentity(@CurrentIdentity() identity: any) {
    const result = await this.identityService.softDeleteIdentity(identity.id);

    return new ApiResponseDto(true, {
      message:
        'Account marked for deletion. You have 90 days to recover by logging in with your seed phrase.',
      recoveryDeadline: result.recoveryDeadline,
    });
  }
}
