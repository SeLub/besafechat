import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactRequest, ContactRequestStatus } from '../contact-request.entity';
import { User } from '../../user/user.entity';
import { MessagesGateway } from '../../message/gateways/messages.gateway';
import { ChatRoomService } from '../../message/services/chat-room.service';

@Injectable()
export class ContactRequestService {
  constructor(
    @InjectRepository(ContactRequest)
    private contactRequestRepository: Repository<ContactRequest>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private messagesGateway: MessagesGateway,
    private chatRoomService: ChatRoomService
  ) {}

  async sendRequest(fromUserId: string, toUserId: string, message?: string) {
    // Check if users exist
    const [fromUser, toUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: fromUserId }, relations: ['username'] }),
      this.userRepository.findOne({ where: { id: toUserId } }),
    ]);

    if (!fromUser || !toUser) {
      throw new NotFoundException('User not found');
    }

    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot send request to yourself');
    }

    // Check if request already exists
    const existingRequest = await this.contactRequestRepository.findOne({
      where: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    });

    if (existingRequest) {
      throw new ConflictException('Contact request already exists');
    }

    // Create new request
    const request = this.contactRequestRepository.create({
      fromUserId,
      toUserId,
      message: message?.trim(),
      status: ContactRequestStatus.PENDING,
    });

    const savedRequest = await this.contactRequestRepository.save(request);

    // Send WebSocket notification
    await this.messagesGateway.notifyContactRequest(
      toUserId,
      fromUser,
      savedRequest.id,
      message?.trim()
    );

    return savedRequest;
  }

  async getIncomingRequests(userId: string) {
    return await this.contactRequestRepository.find({
      where: { toUserId: userId, status: ContactRequestStatus.PENDING },
      relations: ['fromUser', 'fromUser.username'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOutgoingRequests(userId: string) {
    return await this.contactRequestRepository.find({
      where: { fromUserId: userId },
      relations: ['toUser', 'toUser.username'],
      order: { createdAt: 'DESC' },
    });
  }

  async acceptRequest(requestId: string, userId: string) {
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, toUserId: userId, status: ContactRequestStatus.PENDING },
      relations: ['fromUser', 'toUser', 'toUser.username'],
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    request.status = ContactRequestStatus.ACCEPTED;
    await this.contactRequestRepository.save(request);

    // Create chat between users
    const chat = await this.chatRoomService.findOrCreatePrivateChat(
      request.fromUserId,
      request.toUserId
    );

    // Send WebSocket notification to request sender
    await this.messagesGateway.notifyRequestAccepted(request.fromUserId, request.toUser, chat.id);

    return { success: true, chatId: chat.id };
  }

  async rejectRequest(requestId: string, userId: string) {
    const request = await this.contactRequestRepository.findOne({
      where: { id: requestId, toUserId: userId, status: ContactRequestStatus.PENDING },
      relations: ['toUser', 'toUser.username'],
    });

    if (!request) {
      throw new NotFoundException('Contact request not found');
    }

    request.status = ContactRequestStatus.REJECTED;
    await this.contactRequestRepository.save(request);

    // Send WebSocket notification to request sender
    await this.messagesGateway.notifyRequestRejected(request.fromUserId, request.toUser);

    return { success: true };
  }

  async checkRequestStatus(userId: string, otherUserId: string) {
    const request = await this.contactRequestRepository.findOne({
      where: [
        { fromUserId: userId, toUserId: otherUserId },
        { fromUserId: otherUserId, toUserId: userId },
      ],
    });

    if (!request) {
      return 'none'; // No request exists
    }

    if (request.status === ContactRequestStatus.ACCEPTED) {
      return 'connected'; // Already contacts
    }

    if (request.fromUserId === userId) {
      return 'sent'; // User sent request
    } else {
      return 'received'; // User received request
    }
  }

  async getAcceptedContacts(userId: string) {
    const requests = await this.contactRequestRepository.find({
      where: [
        { fromUserId: userId, status: ContactRequestStatus.ACCEPTED },
        { toUserId: userId, status: ContactRequestStatus.ACCEPTED },
      ],
      relations: ['fromUser', 'toUser', 'fromUser.username', 'toUser.username'],
      order: { updatedAt: 'DESC' },
    });

    return requests.map((request) => {
      // Get the other user (not the current user)
      const otherUser = request.fromUserId === userId ? request.toUser : request.fromUser;

      return {
        id: request.id,
        user: {
          id: otherUser.id,
          displayName: otherUser.displayName,
          username: otherUser.username?.username,
        },
        acceptedAt: request.updatedAt,
      };
    });
  }
}
