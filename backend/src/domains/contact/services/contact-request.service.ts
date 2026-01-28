import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Handle } from '../../handle/handle.entity';
import { Identity } from '../../identity/identity.entity';
import { MessagesGateway } from '../../message/gateways/messages.gateway';
import { ChatRoomService } from '../../message/services/chat-room.service';
import { ContactRequest, ContactRequestStatus } from '../contact-request.entity';

@Injectable()
export class ContactRequestService {
  constructor(
    @InjectRepository(ContactRequest)
    private contactRequestRepository: Repository<ContactRequest>,
    @InjectRepository(Identity)
    private identityRepository: Repository<Identity>,
    @InjectRepository(Handle)
    private handleRepository: Repository<Handle>,
    private messagesGateway: MessagesGateway,
    private chatRoomService: ChatRoomService
  ) {}

  async sendRequest(fromHandleId: string, toHandleId: string, message?: string) {
    // Check if handles exist
    const [fromHandle, toHandle] = await Promise.all([
      this.handleRepository.findOne({ where: { id: fromHandleId }, relations: ['ownerIdentity'] }),
      this.handleRepository.findOne({ where: { id: toHandleId }, relations: ['ownerIdentity'] }),
    ]);

    if (!fromHandle || !toHandle) {
      throw new NotFoundException('Handle not found');
    }

    if (fromHandleId === toHandleId) {
      throw new BadRequestException('Cannot send request to yourself');
    }

    // Check if request already exists
    const existingRequest = await this.contactRequestRepository.findOne({
      where: [
        { fromHandleId, toHandleId },
        { fromHandleId: toHandleId, toHandleId: fromHandleId },
      ],
    });

    if (existingRequest) {
      throw new ConflictException('Contact request already exists');
    }

    // Create new request
    const request = this.contactRequestRepository.create({
      fromHandleId,
      toHandleId,
      message: message?.trim(),
      status: ContactRequestStatus.PENDING,
    });

    const savedRequest = await this.contactRequestRepository.save(request);

    // Send WebSocket notification
    await this.messagesGateway.notifyContactRequest(
      toHandle.ownerIdentity.id,
      fromHandle,
      savedRequest.id,
      message?.trim()
    );

    return savedRequest;
  }

  async getIncomingRequests(handleId: string) {
    return await this.contactRequestRepository.find({
      where: { toHandleId: handleId, status: ContactRequestStatus.PENDING },
      relations: ['fromHandle', 'fromHandle.ownerIdentity', 'fromHandle.profile'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOutgoingRequests(handleId: string) {
    return await this.contactRequestRepository.find({
      where: { fromHandleId: handleId },
      relations: ['toHandle', 'toHandle.ownerIdentity', 'toHandle.profile'],
      order: { createdAt: 'DESC' },
    });
  }

  async acceptRequest(requestId: string, handleId: string) {
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, toHandleId: handleId, status: ContactRequestStatus.PENDING },
      relations: [
        'fromHandle',
        'fromHandle.ownerIdentity',
        'fromHandle.profile',
        'toHandle.ownerIdentity',
        'toHandle.profile',
      ],
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    request.status = ContactRequestStatus.ACCEPTED;
    await this.contactRequestRepository.save(request);

    // Create chat between users
    const chat = await this.chatRoomService.findOrCreatePrivateChat(
      request.fromHandleId,
      request.toHandleId
    );

    // Send WebSocket notification to request sender (they now have a chat available with accepter)
    await this.messagesGateway.notifyRequestAccepted(
      request.fromHandleId, // Use handle ID instead of identity ID
      request.toHandle,
      chat.id
    );

    // Also notify the user who accepted the request that a new chat is available
    await this.messagesGateway.notifyNewChatAvailable(
      request.toHandleId, // Notify the accepter
      request.fromHandle,
      chat.id
    );

    return { success: true, chatId: chat.id };
  }

  async acceptRequestByIdentity(requestId: string, identityId: string) {
    // First, get the contact request by ID only
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, status: ContactRequestStatus.PENDING },
      relations: [
        'fromHandle',
        'fromHandle.ownerIdentity',
        'fromHandle.profile',
        'toHandle.ownerIdentity',
        'toHandle.profile',
      ],
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    // Verify that the requesting user owns the handle that received the contact request
    // Check if the identity owns the toHandleId
    const targetHandle = await this.handleRepository.findOne({
      where: { id: request.toHandleId, ownerIdentityId: identityId },
    });

    if (!targetHandle) {
      throw new NotFoundException('Contact request not found');
    }

    request.status = ContactRequestStatus.ACCEPTED;
    await this.contactRequestRepository.save(request);

    // Create chat between users
    const chat = await this.chatRoomService.findOrCreatePrivateChat(
      request.fromHandleId,
      request.toHandleId
    );

    // Send WebSocket notification to request sender
    await this.messagesGateway.notifyRequestAccepted(
      request.fromHandleId, // Use handle ID instead of identity ID (keeping the correction)
      request.toHandle,
      chat.id
    );

    // Also notify the user who accepted the request that a new chat is available
    await this.messagesGateway.notifyNewChatAvailable(
      request.toHandleId, // Notify the accepter
      request.fromHandle,
      chat.id
    );

    return { success: true, chatId: chat.id };
  }

  async rejectRequest(requestId: string, handleId: string) {
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, toHandleId: handleId, status: ContactRequestStatus.PENDING },
      relations: [
        'fromHandle',
        'fromHandle.ownerIdentity',
        'fromHandle.profile',
        'toHandle',
        'toHandle.ownerIdentity',
        'toHandle.profile',
      ],
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    request.status = ContactRequestStatus.REJECTED;
    await this.contactRequestRepository.save(request);

    // Send WebSocket notification to request sender
    await this.messagesGateway.notifyRequestRejected(
      request.fromHandleId, // Use handle ID instead of identity ID
      request.toHandle
    );

    return { success: true };
  }

  async rejectRequestByIdentity(requestId: string, identityId: string) {
    // First, get the contact request by ID only
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, status: ContactRequestStatus.PENDING },
      relations: [
        'fromHandle',
        'fromHandle.ownerIdentity',
        'fromHandle.profile',
        'toHandle',
        'toHandle.ownerIdentity',
        'toHandle.profile',
      ],
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    // Verify that the requesting user owns the handle that received the contact request
    // Check if the identity owns the toHandleId
    const targetHandle = await this.handleRepository.findOne({
      where: { id: request.toHandleId, ownerIdentityId: identityId },
    });

    if (!targetHandle) {
      throw new NotFoundException('Contact request not found');
    }

    request.status = ContactRequestStatus.REJECTED;
    await this.contactRequestRepository.save(request);

    // Send WebSocket notification to request sender
    await this.messagesGateway.notifyRequestRejected(
      request.fromHandleId, // Use handle ID instead of identity ID
      request.toHandle
    );

    return { success: true };
  }

  async checkRequestStatus(handleId: string, otherHandleId: string) {
    const request = await this.contactRequestRepository.findOne({
      where: [
        { fromHandleId: handleId, toHandleId: otherHandleId },
        { fromHandleId: otherHandleId, toHandleId: handleId },
      ],
    });

    if (!request) {
      return 'none'; // No request exists
    }

    if (request.status === ContactRequestStatus.ACCEPTED) {
      return 'connected'; // Already contacts
    }

    if (request.fromHandleId === handleId) {
      return 'sent'; // User sent request
    } else {
      return 'received'; // User received request
    }
  }

  async getAcceptedContacts(handleId: string) {
    const requests = await this.contactRequestRepository.find({
      where: [
        { fromHandleId: handleId, status: ContactRequestStatus.ACCEPTED },
        { toHandleId: handleId, status: ContactRequestStatus.ACCEPTED },
      ],
      relations: [
        'fromHandle',
        'fromHandle.ownerIdentity',
        'fromHandle.profile',
        'toHandle.ownerIdentity',
        'toHandle',
        'toHandle.profile',
      ],
      order: { updatedAt: 'DESC' },
    });

    return requests.map((request) => {
      // Get the other user (not the current user)
      const otherHandle = request.fromHandleId === handleId ? request.toHandle : request.fromHandle;

      return {
        id: request.id,
        user: {
          id: otherHandle.id, // Use handle ID instead of identity ID
          displayName: otherHandle.profile?.displayName,
          handle: otherHandle.value,
        },
        acceptedAt: request.updatedAt,
      };
    });
  }

  async sendRequestByIdentity(fromIdentityId: string, toIdentityId: string, message?: string) {
    // Get primary handles for both identities
    const [fromHandle, toHandle] = await Promise.all([
      this.handleRepository.findOne({
        where: { ownerIdentityId: fromIdentityId, isPrimary: true, type: 'account' },
      }),
      this.handleRepository.findOne({
        where: { ownerIdentityId: toIdentityId, isPrimary: true, type: 'account' },
      }),
    ]);

    if (!fromHandle) {
      throw new NotFoundException('Sender does not have a primary handle');
    }

    if (!toHandle) {
      throw new NotFoundException('Recipient does not have a primary handle');
    }

    // Use the existing sendRequest method with handle IDs
    return await this.sendRequest(fromHandle.id, toHandle.id, message);
  }

  async getPrimaryHandleForIdentity(identityId: string) {
    return await this.handleRepository.findOne({
      where: { ownerIdentityId: identityId, isPrimary: true, type: 'account' },
    });
  }
}
