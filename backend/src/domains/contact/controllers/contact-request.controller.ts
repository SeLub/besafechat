import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
// Remove direct Express import for future Fastify compatibility
import { ContactRequestService } from '../services/contact-request.service';
import { SendRequestDto } from '../dto/send-request.dto';
import { JwtSessionGuard } from '../../user/guards/jwt-session.guard';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';

// Define interface for request with user property
interface RequestWithUser {
  user?: {
    id: string;
    sessionId: string;
    publicKey: Buffer;
  };
}

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class ContactRequestController {
  constructor(private contactRequestService: ContactRequestService) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({ summary: 'Send contact request' })
  async sendRequest(@Req() req: RequestWithUser, @Body() dto: SendRequestDto) {
    const request = await this.contactRequestService.sendRequest(
      req.user!.id,
      dto.toUserId,
      dto.message
    );

    return {
      success: true,
      requestId: request.id,
      message: 'Contact request sent successfully',
    };
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'Get incoming contact requests' })
  async getIncomingRequests(@Req() req: RequestWithUser) {
    const requests = await this.contactRequestService.getIncomingRequests(req.user!.id);

    return {
      requests: requests.map((request) => ({
        id: request.id,
        fromUser: {
          id: request.fromUser.id,
          displayName: request.fromUser.displayName,
          username: request.fromUser.username?.username,
        },
        message: request.message,
        createdAt: request.createdAt,
      })),
    };
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'Get outgoing contact requests' })
  async getOutgoingRequests(@Req() req: RequestWithUser) {
    const requests = await this.contactRequestService.getOutgoingRequests(req.user!.id);

    return {
      requests: requests.map((request) => ({
        id: request.id,
        toUser: {
          id: request.toUser.id,
          displayName: request.toUser.displayName,
          username: request.toUser.username?.username,
        },
        message: request.message,
        status: request.status,
        createdAt: request.createdAt,
      })),
    };
  }

  @Post('requests/:id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept contact request' })
  async acceptRequest(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) requestId: string) {
    return await this.contactRequestService.acceptRequest(requestId, req.user!.id);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject contact request' })
  async rejectRequest(@Req() req: RequestWithUser, @Param('id', ParseUUIDPipe) requestId: string) {
    return await this.contactRequestService.rejectRequest(requestId, req.user!.id);
  }

  @Get('check/:userId')
  @ApiOperation({ summary: 'Check contact request status with user' })
  async checkRequestStatus(
    @Req() req: RequestWithUser,
    @Param('userId', ParseUUIDPipe) userId: string
  ) {
    const status = await this.contactRequestService.checkRequestStatus(req.user!.id, userId);
    return {
      success: true,
      data: { status },
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get accepted contacts' })
  async getContacts(@Req() req: RequestWithUser) {
    const contacts = await this.contactRequestService.getAcceptedContacts(req.user!.id);
    return { contacts };
  }
}
