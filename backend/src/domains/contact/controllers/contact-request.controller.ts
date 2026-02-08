import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RedisService } from '../../../domains/redis/redis.service';
import { CurrentHandle } from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { SendRequestDto } from '../dto/send-request.dto';
import { MediaService } from '../../media/media.service';
import { ContactRequestService } from '../services/contact-request.service';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class ContactRequestController {
  constructor(
    private contactRequestService: ContactRequestService,
    private redisService: RedisService,
    private mediaService: MediaService
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'Send contact request',
    description:
      'Sends a contact request to another user. The request will be pending until the recipient accepts or rejects it.',
  })
  @ApiBody({
    description: 'Contact request details',
    type: SendRequestDto,
    examples: {
      example1: {
        summary: 'Example contact request',
        value: {
          toHandleId: 'abc123-def456-ghi789-jkl012',
          message: "Hi, let's connect!",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data (e.g. invalid UUID, message too long)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  async sendRequest(@CurrentHandle() handle: any, @Body() dto: SendRequestDto) {
    const request = await this.contactRequestService.sendRequest(
      handle.id,
      dto.toHandleId,
      dto.message
    );

    return {
      success: true,
      requestId: request.id,
      message: 'Contact request sent successfully',
    };
  }

  @Get('requests/incoming')
  @ApiOperation({
    summary: 'Get incoming contact requests',
    description: 'Retrieves all pending contact requests sent to the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved incoming contact requests',
    schema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'abc123-def456-ghi789' },
              from: {
                type: 'object',
                properties: {
                  handleId: { type: 'string', example: 'xyz789-uvw012-stu345' },
                  value: { type: 'string', example: 'user_123456789' },
                  displayName: { type: 'string', example: 'John Doe' },
                  firstName: { type: 'string', example: 'John' },
                  lastName: { type: 'string', example: 'Doe' },
                  avatarUrl: { type: 'string', example: 'https://example.com/avatar.jpg' },
                  bio: { type: 'string', example: 'Software Engineer' },
                },
              },
              to: {
                type: 'object',
                properties: {
                  handleId: { type: 'string', example: 'abc123-def456-ghi789' },
                },
              },
              message: { type: 'string', example: "Hi, let's connect!" },
              createdAt: { type: 'string', example: '2023-01-01T10:00:00.000Z' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  async getIncomingRequests(@CurrentHandle() handle: any) {
    const requests = await this.contactRequestService.getIncomingRequests(handle.id);

    return {
      requests: await Promise.all(
        requests.map(async (request) => {
          const avatarUrl = request.fromHandle?.id
            ? await this.mediaService.getAvatarUrlIfExists(request.fromHandle.id)
            : null;

          return {
            id: request.id,
            from: {
              handleId: request.fromHandle?.id || '',
              value: request.fromHandle?.value || '',
              displayName: request.fromHandle?.profile?.displayName,
              firstName: request.fromHandle?.profile?.firstName,
              lastName: request.fromHandle?.profile?.lastName,
              avatarUrl,
              bio: request.fromHandle?.profile?.bio,
            },
            to: {
              handleId: request.toHandle?.id || '',
            },
            message: request.message,
            createdAt: request.createdAt,
          };
        })
      ),
    };
  }

  @Get('requests/outgoing')
  @ApiOperation({
    summary: 'Get outgoing contact requests',
    description: 'Retrieves all contact requests sent by the current user that are still pending.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved outgoing contact requests',
    schema: {
      type: 'object',
      properties: {
        requests: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'abc123-def456-ghi789' },
              from: {
                type: 'object',
                properties: {
                  handleId: { type: 'string', example: 'xyz789-uvw012-stu345' },
                  value: { type: 'string', example: 'user_123456789' },
                  displayName: { type: 'string', example: 'Jane Smith' },
                  firstName: { type: 'string', example: 'Jane' },
                  lastName: { type: 'string', example: 'Smith' },
                  avatarUrl: { type: 'string', example: 'https://example.com/avatar.jpg' },
                  bio: { type: 'string', example: 'Designer' },
                },
              },
              to: {
                type: 'object',
                properties: {
                  handleId: { type: 'string', example: 'abc123-def456-ghi789' },
                },
              },
              message: { type: 'string', example: "Hi, let's connect!" },
              status: {
                type: 'string',
                example: 'pending',
                enum: ['pending', 'accepted', 'rejected'],
              },
              createdAt: { type: 'string', example: '2023-01-01T10:00:00.000Z' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  async getOutgoingRequests(@CurrentHandle() handle: any) {
    const requests = await this.contactRequestService.getOutgoingRequests(handle.id);

    return {
      requests: await Promise.all(
        requests.map(async (request) => {
          const avatarUrl = request.fromHandle?.id
            ? await this.mediaService.getAvatarUrlIfExists(request.fromHandle.id)
            : null;

          return {
            id: request.id,
            from: {
              handleId: request.fromHandle?.id || '',
              value: request.fromHandle?.value || '',
              displayName: request.fromHandle?.profile?.displayName || '',
              firstName: request.fromHandle?.profile?.firstName || null,
              lastName: request.fromHandle?.profile?.lastName || null,
              avatarUrl,
              bio: request.fromHandle?.profile?.bio || null,
            },
            to: {
              handleId: request.toHandle?.id || '',
            },
            message: request.message,
            status: request.status,
            createdAt: request.createdAt,
          };
        })
      ),
    };
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept contact request',
    description: 'Accepts a contact request from another user. This creates a mutual connection.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contact request ID to accept',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  @ApiBadRequestResponse({ description: 'Invalid request data (e.g. invalid UUID format)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  @ApiNotFoundResponse({ description: 'Contact request not found' })
  async acceptRequest(
    @CurrentHandle() handle: any,
    @Param('id', ParseUUIDPipe) requestId: string
  ) {
    return await this.contactRequestService.acceptRequest(requestId, handle.id);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject contact request',
    description:
      'Rejects a contact request from another user. The request will be marked as rejected.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contact request ID to reject',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  @ApiBadRequestResponse({ description: 'Invalid request data (e.g. invalid UUID format)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  @ApiNotFoundResponse({ description: 'Contact request not found' })
  async rejectRequest(
    @CurrentHandle() handle: any,
    @Param('id', ParseUUIDPipe) requestId: string
  ) {
    return await this.contactRequestService.rejectRequest(requestId, handle.id);
  }

  @Get('check/:handleId')
  @ApiOperation({
    summary: 'Check contact request status with handle',
    description:
      'Checks the current status of the contact relationship with another handle. Possible statuses: none (no request exchanged), sent (request sent by current user), received (request received from other user), connected (mutual connection established).',
  })
  @ApiParam({
    name: 'handleId',
    description: 'Handle ID to check contact request status with',
    type: String,
    example: 'abc123-def456-ghi789',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved contact status',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'connected',
              enum: ['none', 'sent', 'received', 'connected', 'rejected'],
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid request data (e.g. invalid UUID format)' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  @ApiNotFoundResponse({ description: 'Handle not found' })
  async checkRequestStatus(
    @CurrentHandle() handle: any,
    @Param('handleId', ParseUUIDPipe) handleId: string
  ) {
    const status = await this.contactRequestService.checkRequestStatus(handle.id, handleId);
    return {
      success: true,
      data: { status },
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get accepted contacts',
    description: 'Retrieves all accepted contacts (mutual connections) for the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved accepted contacts',
    schema: {
      type: 'object',
      properties: {
        contacts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'abc123-def456-ghi789' },
              handle: { type: 'string', example: 'user_123456789' },
              displayName: { type: 'string', example: 'John Doe' },
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized - invalid or missing access token' })
  async getContacts(@CurrentHandle() handle: any) {
    const contacts = await this.contactRequestService.getAcceptedContacts(handle.id);
    return { contacts };
  }

  @Post('bulk-online-status')
  @ApiOperation({
    summary: 'Get bulk online status for multiple handles',
    description: 'Retrieves the online status for multiple handles at once.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of handle IDs to check online status for',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Returns online status for each handle',
    schema: {
      type: 'object',
      properties: {
        statuses: {
          type: 'object',
          additionalProperties: { type: 'boolean' },
        },
      },
    },
  })
  async getBulkOnlineStatus(@Body() body: { userIds: string[] }) {
    const { userIds } = body;
    const redis = this.redisService.getClient();

    const statuses: Record<string, boolean> = {};

    for (const handleId of userIds) {
      const status = await redis.get(`online:${handleId}`);
      statuses[handleId] = status === '1';
    }

    return { statuses };
  }
}
