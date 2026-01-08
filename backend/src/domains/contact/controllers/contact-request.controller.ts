import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
// Remove direct Express import for future Fastify compatibility
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { SendRequestDto } from '../dto/send-request.dto';
import { ContactRequestService } from '../services/contact-request.service';

// Define interface for request with identity property
interface RequestWithIdentity {
  user?: {
    id: string; // This is now identityId
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
  async sendRequest(@Req() req: RequestWithIdentity, @Body() dto: SendRequestDto) {
    const request = await this.contactRequestService.sendRequest(
      req.user!.id,
      dto.toIdentityId,
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
  async getIncomingRequests(@Req() req: RequestWithIdentity) {
    const requests = await this.contactRequestService.getIncomingRequests(req.user!.id);

    return {
      requests: requests.map((request) => ({
        id: request.id,
        fromHandle: {
          id: request.fromHandle.id,
          displayName: request.fromHandle.ownerIdentity.profiles?.[0]?.displayName,
          handle: request.fromHandle.value,
        },
        message: request.message,
        createdAt: request.createdAt,
      })),
    };
  }

  @Get('requests/outgoing')
  @ApiOperation({ summary: 'Get outgoing contact requests' })
  async getOutgoingRequests(@Req() req: RequestWithIdentity) {
    const requests = await this.contactRequestService.getOutgoingRequests(req.user!.id);

    return {
      requests: requests.map((request) => ({
        id: request.id,
        toHandle: {
          id: request.toHandle.id,
          displayName: request.toHandle.ownerIdentity.profiles?.[0]?.displayName,
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
  @ApiOperation({ summary: 'Accept contact request' })
  async acceptRequest(
    @Req() req: RequestWithIdentity,
    @Param('id', ParseUUIDPipe) requestId: string
  ) {
    return await this.contactRequestService.acceptRequest(requestId, req.user!.id);
  }

  @Post('requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject contact request' })
  async rejectRequest(
    @Req() req: RequestWithIdentity,
    @Param('id', ParseUUIDPipe) requestId: string
  ) {
    return await this.contactRequestService.rejectRequest(requestId, req.user!.id);
  }

  @Get('check/:userId')
  @ApiOperation({ summary: 'Check contact request status with user' })
  async checkRequestStatus(
    @Req() req: RequestWithIdentity,
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
  async getContacts(@Req() req: RequestWithIdentity) {
    const contacts = await this.contactRequestService.getAcceptedContacts(req.user!.id);
    return { contacts };
  }
}
