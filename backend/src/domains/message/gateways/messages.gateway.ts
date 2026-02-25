// src/domains/message/gateways/messages.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../../domains/redis/redis.service';
import { SessionService } from '../../session/services/session.service';
import { NotificationService } from '../../notification/services/notification.service';
import { MessagePayloadDto } from '../dtos/message-payload.dto';
import { ChatRoomService } from '../services/chat-room.service';
import { MessageMetadataService } from '../services/message-metadata.service';
import { MediaService } from '../../media/media.service';
import { getCorsConfig } from '../../../common/config/cors-origins';

@WebSocketGateway({
  namespace: '/messages',
  cors: getCorsConfig(),
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private sessionService: SessionService,
    private redisService: RedisService,
    private messageMetadataService: MessageMetadataService,
    private chatRoomService: ChatRoomService,
    private notificationService: NotificationService,
    private mediaService: MediaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      console.log('🔌 WebSocket connection attempt');

      // 1. Извлекаем access_token из кук (Socket.IO поддерживает!)
      const cookieHeader = client.handshake.headers.cookie;
      if (!cookieHeader) {
        console.log('❌ No cookie header found');
        client.disconnect(true);
        return;
      }

      const accessToken = cookieHeader
        .split('; ')
        .find((part) => part.startsWith('access_token='))
        ?.split('=')[1];

      if (!accessToken) {
        console.log('❌ No access token found in cookies');
        client.disconnect(true);
        return;
      }

      // 2. Валидируем сессию
      const session = await this.sessionService.validateAccessToken(accessToken);
      if (!session || session.revoked) {
        console.log('❌ Invalid or revoked session');
        client.disconnect(true);
        return;
      }

      // 3. Сохраняем данные в сокет
      client.data.identityId = session.identity.id;
      client.data.activeHandleId = session.activeHandleId;
      client.data.sessionId = session.id;

      console.log(
        `👤 Client connected: identity=${session.identity.id}, handle=${session.activeHandleId}`
      );

      // 4. Подключаем к комнате по handleId (пользователь может иметь несколько handle'ов)
      if (session.activeHandleId) {
        console.log(`🚪 Joining room: user:${session.activeHandleId}`);
        await client.join(`user:${session.activeHandleId}`);
        console.log(`✅ Joined room: user:${session.activeHandleId}`);
      }

      // 5. Обновляем онлайн-статус по handleId
      if (session.activeHandleId) {
        const redis = this.redisService.getClient();
        // Set online status with TTL of 120 seconds to handle connection failures
        await redis.setex(`online:${session.activeHandleId}`, 120, '1');
        console.log(`🌐 Online status set for handle: ${session.activeHandleId}`);

        // 6. Уведомляем контакты о том, что пользователь онлайн
        await this.notifyContactsUserOnline(session.activeHandleId);
        
        // 7. Синхронизация уведомлений при подключении
        await this.syncNotifications(client, session.activeHandleId);
      }
    } catch (error) {
      console.error('❌ WebSocket connection error:', error);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data?.activeHandleId) {
      const handleId = client.data.activeHandleId;
      const redis = this.redisService.getClient();

      // Clear online status from Redis
      await redis.del(`online:${handleId}`);

      // Notify contacts that user went offline
      await this.notifyContactsUserOffline(handleId);
    }
  }

  @SubscribeMessage('message')
  async handleMessage(client: Socket, payload: MessagePayloadDto) {
    try {
      const { to, type, encryptedContent, encryptedKey, timestamp } = payload;

      console.log(
        `📨 Message received: from=${client.data.activeHandleId}, to=${to}, type=${type}`
      );
      console.log(
        `📊 Payload details: encryptedKey length=${encryptedKey.length}, timestamp=${timestamp}`
      );

      // Сохраняем метаданные и получаем ID чата и сообщения
      // Use activeHandleId instead of identityId (both should be handle IDs)
      const result = await this.messageMetadataService.save(
        client.data.activeHandleId,
        to,
        payload
      );
      const { chatId, messageId } = result;
      console.log(`💾 Message metadata saved, chatId=${chatId}, messageId=${messageId}`);

      // Check if the target room has any connected sockets
      const room = this.server.sockets.adapter?.rooms?.get(`user:${to}`);
      const roomSize = room ? room.size : 0;
      console.log(`👥 Target room 'user:${to}' has ${roomSize} connected sockets`);

      // Generate a unique message ID for client-side tracking if not available from metadata
      const uniqueMessageId =
        messageId ||
        `${client.data.activeHandleId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Отправляем сообщение всем онлайн-сокетам получателя (по handleId)
      console.log(`📤 Emitting message to room: user:${to}`);
      this.server.to(`user:${to}`).emit('message:new', {
        id: uniqueMessageId,
        from: client.data.activeHandleId, // ✅ Use activeHandleId instead of identityId
        chatId,
        type,
        encryptedContent,
        encryptedKey,
        timestamp,
      });
      console.log(`✅ Message emitted to room: user:${to}`);
    } catch (error) {
      console.error('❌ Message handling error:', error);
      client.emit('message:error', { error: 'Failed to send message' });
    }
  }

  // Contact request notifications
  async notifyContactRequest(
    toHandleId: string,
    fromHandle: any,
    requestId: string,
    message?: string
  ) {
    const notification = await this.notificationService.createNotification(toHandleId, 'contact_request', {
      fromHandle: {
        id: fromHandle.id,
        value: fromHandle.value,
        displayName: fromHandle.profile?.displayName,
      },
      requestId,
      message,
    });

    this.server.to(`user:${toHandleId}`).emit('notification:created', notification);
    this.server.to(`user:${toHandleId}`).emit('contact_request_received', {
      requestId,
      fromHandle: {
        id: fromHandle.id,
        value: fromHandle.value,
        alias: fromHandle.alias || null,
        displayName: fromHandle.profile?.displayName,
        firstName: fromHandle.profile?.firstName || null,
        lastName: fromHandle.profile?.lastName || null,
        handle: fromHandle.value,
        avatarUrl: fromHandle.profile?.avatarUrl || null,
        bio: fromHandle.profile?.bio || null,
      },
      message,
      timestamp: new Date().toISOString(),
    });
  }

  async notifyContactAccepted(toHandleId: string, otherHandle: any, chatId?: string) {
    // Load avatar URL if it exists
    const avatarUrl = otherHandle.id
      ? await this.mediaService.getAvatarUrlIfExists(otherHandle.id)
      : null;

    // Create notification in DB
    const notification = await this.notificationService.createNotification(
      toHandleId,
      'contact_accepted',
      {
        fromHandle: {
          id: otherHandle.id,
          value: otherHandle.value,
          displayName: otherHandle.profile?.displayName,
        },
        chatId,
      }
    );

    // Single unified event with all necessary data
    this.server.to(`user:${toHandleId}`).emit('notification:created', notification);
    this.server.to(`user:${toHandleId}`).emit('contact_accepted', {
      otherHandle: {
        id: otherHandle.id,
        displayName: otherHandle.profile?.displayName,
        handle: otherHandle.value,
        firstName: otherHandle.profile?.firstName || null,
        lastName: otherHandle.profile?.lastName || null,
        avatarUrl,
        bio: otherHandle.profile?.bio || null,
        alias: otherHandle.alias || null,
      },
      chatId,
      timestamp: new Date().toISOString(),
    });
  }

  // Deprecated: Use notifyContactAccepted instead
  async notifyRequestAccepted(toHandleId: string, byHandle: any, chatId?: string) {
    return this.notifyContactAccepted(toHandleId, byHandle, chatId);
  }

  async notifyRequestRejected(toHandleId: string, byHandle: any) {
    const notification = await this.notificationService.createNotification(toHandleId, 'contact_rejected', {
      fromHandle: {
        id: byHandle.id,
        value: byHandle.value,
        displayName: byHandle.profile?.displayName,
      },
    });

    this.server.to(`user:${toHandleId}`).emit('notification:created', notification);
    this.server.to(`user:${toHandleId}`).emit('contact_request_rejected', {
      byHandle: {
        id: byHandle.id,
        displayName: byHandle.profile?.displayName,
        handle: byHandle.value,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async notifyNewChatAvailable(toHandleId: string, fromHandle: any, chatId?: string) {
    // Load avatar URL if it exists
    const avatarUrl = fromHandle.id
      ? await this.mediaService.getAvatarUrlIfExists(fromHandle.id)
      : null;

    const notification = await this.notificationService.createNotification(toHandleId, 'new_chat', {
      fromHandle: {
        id: fromHandle.id,
        value: fromHandle.value,
        displayName: fromHandle.profile?.displayName,
      },
      chatId,
    });

    this.server.to(`user:${toHandleId}`).emit('notification:created', notification);
    this.server.to(`user:${toHandleId}`).emit('new_chat_available', {
      fromHandle: {
        id: fromHandle.id,
        displayName: fromHandle.profile?.displayName,
        handle: fromHandle.value,
        firstName: fromHandle.profile?.firstName || null,
        lastName: fromHandle.profile?.lastName || null,
        avatarUrl,
        bio: fromHandle.profile?.bio || null,
        alias: fromHandle.alias || null,
      },
      chatId,
      timestamp: new Date().toISOString(),
    });
  }

  // Heartbeat для поддержания онлайн-статуса
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(client: Socket) {
    if (client.data?.activeHandleId) {
      const redis = this.redisService.getClient();
      // Refresh online status with extended expiry
      await redis.setex(`online:${client.data.activeHandleId}`, 120, '1');
    }
  }

  // Синхронизация уведомлений при подключении
  private async syncNotifications(client: Socket, handleId: string) {
    try {
      const notifications = await this.notificationService.getUnreadNotifications(handleId);
      const unreadCount = await this.notificationService.getUnreadCount(handleId);
      
      client.emit('notifications:sync', {
        notifications,
        unreadCount,
        timestamp: new Date().toISOString(),
      });
      
      console.log(`🔔 Synced ${notifications.length} notifications for handle: ${handleId}`);
    } catch (error) {
      console.error('❌ Error syncing notifications:', error);
    }
  }

  @SubscribeMessage('notifications:request-sync')
  async handleNotificationSync(client: Socket) {
    if (client.data?.activeHandleId) {
      await this.syncNotifications(client, client.data.activeHandleId);
    }
  }

  @SubscribeMessage('notification:mark-read')
  async handleMarkAsRead(client: Socket, payload: { notificationId: string }) {
    if (client.data?.activeHandleId) {
      await this.notificationService.markAsRead(client.data.activeHandleId, payload.notificationId);
      const unreadCount = await this.notificationService.getUnreadCount(client.data.activeHandleId);
      
      // Уведомляем все устройства пользователя
      this.server.to(`user:${client.data.activeHandleId}`).emit('notification:read', {
        notificationId: payload.notificationId,
        unreadCount,
      });
    }
  }

  @SubscribeMessage('notification:mark-all-read')
  async handleMarkAllAsRead(client: Socket) {
    if (client.data?.activeHandleId) {
      await this.notificationService.markAllAsRead(client.data.activeHandleId);
      
      // Уведомляем все устройства пользователя
      this.server.to(`user:${client.data.activeHandleId}`).emit('notification:all-read', {
        unreadCount: 0,
      });
    }
  }

  // Уведомление контактов о статусе онлайн
  async notifyContactsUserOnline(activeHandleId: string) {
    try {
      console.log(`🌐 Notifying contacts that handle ${activeHandleId} is online`);

      // Get all handles that share chats with the active handle
      const relatedHandles = await this.getRelatedHandles(activeHandleId);
      console.log(`🔗 Found ${relatedHandles.length} related handles:`, relatedHandles);

      // Emit to each related user's room
      for (const handleId of relatedHandles) {
        console.log(`📤 Emitting online status to handle: ${handleId}`);

        // Check if the target room has any connected sockets
        const room = this.server.sockets.adapter?.rooms?.get(`user:${handleId}`);
        const roomSize = room ? room.size : 0;
        console.log(`👥 Target room 'user:${handleId}' has ${roomSize} connected sockets`);

        this.server.to(`user:${handleId}`).emit('user_online', { handleId: activeHandleId });
        console.log(`✅ Online status emitted to handle: ${handleId}`);
      }
    } catch (error) {
      console.error('Error notifying contacts of online status:', error);
    }
  }

  // Уведомление контактов о статусе оффлайн
  async notifyContactsUserOffline(activeHandleId: string) {
    try {
      console.log(`📴 Notifying contacts that handle ${activeHandleId} is offline`);

      // Get all handles that share chats with the active handle
      const relatedHandles = await this.getRelatedHandles(activeHandleId);
      console.log(`🔗 Found ${relatedHandles.length} related handles:`, relatedHandles);

      // Emit to each related user's room
      for (const handleId of relatedHandles) {
        console.log(`📤 Emitting offline status to handle: ${handleId}`);

        // Check if the target room has any connected sockets
        const room = this.server.sockets.adapter?.rooms?.get(`user:${handleId}`);
        const roomSize = room ? room.size : 0;
        console.log(`👥 Target room 'user:${handleId}' has ${roomSize} connected sockets`);

        this.server.to(`user:${handleId}`).emit('user_offline', { handleId: activeHandleId });
        console.log(`✅ Offline status emitted to handle: ${handleId}`);
      }
    } catch (error) {
      console.error('Error notifying contacts of offline status:', error);
    }
  }

  // Helper method to find handles related to a given handle (through chats or contacts)
  private async getRelatedHandles(handleId: string): Promise<string[]> {
    console.log(`🔍 Finding related handles for: ${handleId}`);
    // Use the ChatRoomService to find handles that share chats with the given handle
    const relatedHandles = await this.chatRoomService.getRelatedHandles(handleId);
    console.log(`🔍 Found related handles for ${handleId}:`, relatedHandles);
    return relatedHandles;
  }
}
