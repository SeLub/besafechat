import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
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
import { HandleService } from '../../handle/services/handle.service';
import { CurrentIdentity } from '../../session/decorators/current-user.decorator';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { SendRequestDto } from '../dto/send-request.dto';
import { ContactRequestService } from '../services/contact-request.service';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class ContactRequestController {
  constructor(
    private contactRequestService: ContactRequestService,
    private handleService: HandleService,
    private redisService: RedisService
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
  async sendRequest(@CurrentIdentity() identity: any, @Body() dto: SendRequestDto) {
    // Get the primary handle ID for the sender
    const fromHandle = await this.contactRequestService.getPrimaryHandleForIdentity(identity.id);

    if (!fromHandle) {
      throw new NotFoundException('Sender does not have a primary handle');
    }

    // Validate that the target handle exists
    const toHandle = await this.handleService.findById(dto.toHandleId);

    if (!toHandle) {
      throw new NotFoundException('Target handle not found');
    }

    // Use the existing sendRequest method with handle IDs directly
    const request = await this.contactRequestService.sendRequest(
      fromHandle.id,
      dto.toHandleId, // Use the handle ID directly from the DTO
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
              fromHandle: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'xyz789-uvw012-stu345' },
                  displayName: { type: 'string', example: 'John Doe' },
                  handle: { type: 'string', example: 'user_123456789' },
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
  async getIncomingRequests(@CurrentIdentity() identity: any) {
    // Get the current active handle for the user's session (or primary handle)
    const handle = await this.contactRequestService.getPrimaryHandleForIdentity(identity.id);

    if (!handle) {
      throw new NotFoundException('User does not have a primary handle');
    }

    const requests = await this.contactRequestService.getIncomingRequests(handle.id);

    return {
      requests: requests.map((request) => ({
        id: request.id,
        fromHandle: {
          id: request.fromHandle.id,
          displayName: request.fromHandle.profile?.displayName,
          handle: request.fromHandle.value,
        },
        message: request.message,
        createdAt: request.createdAt,
      })),
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
              toHandle: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'xyz789-uvw012-stu345' },
                  displayName: { type: 'string', example: 'Jane Smith' },
                  handle: { type: 'string', example: 'user_987654321' },
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
  async getOutgoingRequests(@CurrentIdentity() identity: any) {
    // Get the current active handle for the user's session (or primary handle)
    const handle = await this.contactRequestService.getPrimaryHandleForIdentity(identity.id);

    if (!handle) {
      throw new NotFoundException('User does not have a primary handle');
    }

    const requests = await this.contactRequestService.getOutgoingRequests(handle.id);

    return {
      requests: requests.map((request) => ({
        id: request.id,
        toHandle: {
          id: request.toHandle.id,
          displayName: request.toHandle.profile?.displayName,
          handle: request.toHandle.value,
        },
        message: request.message,
        status: request.status,
        createdAt: request.createdAt,
      })),
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
    @CurrentIdentity() identity: any,
    @Param('id', ParseUUIDPipe) requestId: string
  ) {
    return await this.contactRequestService.acceptRequestByIdentity(requestId, identity.id);
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
    @CurrentIdentity() identity: any,
    @Param('id', ParseUUIDPipe) requestId: string
  ) {
    return await this.contactRequestService.rejectRequestByIdentity(requestId, identity.id);
  }

  @Get('check/:userId')
  @ApiOperation({
    summary: 'Check contact request status with user',
    description:
      'Checks the current status of the contact relationship with another user. Possible statuses: none (no request exchanged), sent (request sent by current user), received (request received from other user), connected (mutual connection established).',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID to check contact request status with',
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
  @ApiNotFoundResponse({ description: 'User not found' })
  async checkRequestStatus(
    @CurrentIdentity() identity: any,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    // Get the current active handle for the user's session (or primary handle)
    const handle = await this.contactRequestService.getPrimaryHandleForIdentity(identity.id);

    if (!handle) {
      throw new NotFoundException('User does not have a primary handle');
    }

    // Convert userId to corresponding handleId
    const otherHandle = await this.contactRequestService.getPrimaryHandleForIdentity(userId);

    if (!otherHandle) {
      throw new NotFoundException('Target user does not have a primary handle');
    }

    const status = await this.contactRequestService.checkRequestStatus(handle.id, otherHandle.id);
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
  async getContacts(@CurrentIdentity() identity: any) {
    // Get the current active handle for the user's session (or primary handle)
    const handle = await this.contactRequestService.getPrimaryHandleForIdentity(identity.id);

    if (!handle) {
      throw new NotFoundException('User does not have a primary handle');
    }

    const contacts = await this.contactRequestService.getAcceptedContacts(handle.id);
    // contacts already has the correct structure based on service implementation
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

    // Get online status for each handle ID
    const statuses: Record<string, boolean> = {};

    for (const handleId of userIds) {
      const status = await redis.get(`online:${handleId}`);
      statuses[handleId] = status === '1';
    }

    return { statuses };
  }
}
