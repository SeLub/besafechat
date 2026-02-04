// src/domains/message/gateways/messages.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../../common/redis.service';
import { SessionService } from '../../session/services/session.service';
import { MessagePayloadDto } from '../dtos/message-payload.dto';
import { MessageMetadataService } from '../services/message-metadata.service';

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private sessionService: SessionService,
    private redisService: RedisService,
    private messageMetadataService: MessageMetadataService
  ) {}

  async handleConnection(client: Socket) {
    try {
      // 1. Извлекаем access_token из кук (Socket.IO поддерживает!)
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) {
        client.disconnect(true);
        return;
      }

      const accessToken = cookieHeader
        .split('; ')
        .find((part) => part.startsWith('access_token='))
        ?.split('=')[1];

      if (!accessToken) {
        client.disconnect(true);
        return;
      }

      // 2. Валидируем сессию
      const session = await this.sessionService.validateAccessToken(accessToken);
      if (!session || session.revoked) {
        client.disconnect(true);
        return;
      }

      // 3. Сохраняем данные в сокет
      client.data.identityId = session.identity.id;
      client.data.sessionId = session.id;

      // 4. Подключаем к комнате пользователя (для 1:1 и групп)
      await client.join(`user:${session.identity.id}`);

      // 5. Обновляем онлайн-статус
      const redis = this.redisService.getClient();
      await redis.setex(`online:${session.identity.id}`, 60, '1');

      // 6. Уведомляем контакты о том, что пользователь онлайн
      await this.notifyContactsUserOnline(session.identity.id);
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data?.identityId) {
      const identityId = client.data.identityId;
      const redis = this.redisService.getClient();
      await redis.del(`online:${identityId}`);
      await this.notifyContactsUserOffline(identityId);
    }
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, payload: MessagePayloadDto) {
    try {
      const { to, type, encryptedContent, encryptedKey, timestamp } = payload;

      // Сохраняем метаданные и получаем ID чата
      const chatId = await this.messageMetadataService.save(client.data.identityId, to, payload);

      // Отправляем сообщение всем онлайн-сокетам получателя
      this.server.to(`user:${to}`).emit('message:new', {
        from: client.data.identityId,
        chatId,
        type,
        encryptedContent,
        encryptedKey,
        timestamp,
      });
    } catch (error) {
      console.error('❌ Message handling error:', error);
      client.emit('message:error', { error: 'Failed to send message' });
    }
  }

  // Contact request notifications
  async notifyContactRequest(
    toIdentityId: string,
    fromIdentity: any,
    requestId: string,
    message?: string
  ) {
    this.server.to(`user:${toIdentityId}`).emit('contact_request_received', {
      requestId,
      fromUser: {
        id: fromIdentity.id,
        displayName: fromIdentity.profiles?.[0]?.displayName,
        handle: fromIdentity.handles?.[0]?.value,
      },
      message,
      timestamp: new Date().toISOString(),
    });
  }

  async notifyRequestAccepted(toIdentityId: string, byIdentity: any, chatId?: string) {
    this.server.to(`user:${toIdentityId}`).emit('contact_request_accepted', {
      byUser: {
        id: byIdentity.id,
        displayName: byIdentity.profiles?.[0]?.displayName,
        handle: byIdentity.handles?.[0]?.value,
      },
      chatId,
      timestamp: new Date().toISOString(),
    });
  }

  async notifyRequestRejected(toIdentityId: string, byIdentity: any) {
    this.server.to(`user:${toIdentityId}`).emit('contact_request_rejected', {
      byUser: {
        id: byIdentity.id,
        displayName: byIdentity.profiles?.[0]?.displayName,
        handle: byIdentity.handles?.[0]?.value,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Heartbeat для поддержания онлайн-статуса
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(client: Socket) {
    if (client.data?.identityId) {
      const redis = this.redisService.getClient();
      await redis.setex(`online:${client.data.identityId}`, 60, '1');
    }
  }

  // Уведомление контактов о статусе онлайн
  private async notifyContactsUserOnline(identityId: string) {
    const sockets = await this.server.fetchSockets();
    sockets.forEach((socket) => {
      const socketIdentityId = (socket as any).data?.identityId;
      if (socketIdentityId && socketIdentityId !== identityId) {
        this.server.to(`user:${socketIdentityId}`).emit('user_online', { identityId });
      }
    });
  }

  // Уведомление контактов о статусе оффлайн
  private async notifyContactsUserOffline(identityId: string) {
    const sockets = await this.server.fetchSockets();
    sockets.forEach((socket) => {
      const socketIdentityId = (socket as any).data?.identityId;
      if (socketIdentityId && socketIdentityId !== identityId) {
        this.server.to(`user:${socketIdentityId}`).emit('user_offline', { identityId });
      }
    });
  }
}
