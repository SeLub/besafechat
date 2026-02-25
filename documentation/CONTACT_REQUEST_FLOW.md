# Полный Флоу Contact Request - Отправка, Принятие, Отказ

## Оглавление
1. [Архитектура системы](#архитектура-системы)
2. [Этап 1: Отправка контактного запроса](#этап-1-отправка-контактного-запроса)
3. [Этап 2: Получатель видит запрос](#этап-2-получатель-видит-запрос)
4. [Этап 3: Принятие запроса](#этап-3-принятие-запроса)
5. [Этап 4: Отказ или Later](#этап-4-отказ-или-later)
6. [WebSocket события](#websocket-события)
7. [REST API endpoints](#rest-api-endpoints)
8. [Структуры данных](#структуры-данных)
9. [Диаграммы](#диаграммы)

---

## Архитектура системы

### Компоненты
```
Frontend (React Router + Socket.IO)
    ↓
REST API (NestJS) ← ИСТОЧНИК ИСТИНЫ (синхронные CRUD)
    ↓
WebSocket Gateway (Socket.IO) ← ТРИГГЕРЫ И УВЕДОМЛЕНИЯ (асинхронные события)
    ↓
Database (PostgreSQL)
    ↓
Redis (Online status, TTL)
```

### Слои обработки контактных запросов
- **Frontend**: 
  - UI компоненты (модалы, списки контактов)
  - REST запросы для состояния
  - WebSocket слушатели для real-time уведомлений
- **REST API (Controller + Service)**: 
  - POST /contacts/requests - отправка запроса
  - GET /contacts/requests?direction=both - получение всех запросов
  - POST /contacts/requests/{id}/accept - принятие
  - POST /contacts/requests/{id}/reject - отказ
- **WebSocket Gateway**: 
  - contact_request_received - уведомление о новом запросе (триггер для модала)
  - contact_accepted - уведомление об принятии (триггер для toast)
  - contact_request_rejected - уведомление об отказе (триггер для UI обновления)
- **Database**: Хранилище запросов и контактов (contact_request, chat, notification)

### Поток данных: REST vs WebSocket
- **REST API** = синхронные операции, гарантированная доставка, источник истины
- **WebSocket** = асинхронные уведомления, best-effort, только триггеры (данные из REST)

---

## Этап 1: Отправка контактного запроса

### Когда это происходит
Пользователь A хочет добавить пользователя B в контакты:
1. Открывает страницу "Новый чат" или "Контакты"
2. Вводит handle пользователя B
3. Нажимает "Отправить запрос"
4. Опционально добавляет сообщение

### Frontend: Отправка запроса

#### Компонент: `new-chat-modal.tsx`
```typescript
// Пользователь заполняет форму и кликает "Send Request"
const handleSendRequest = async (targetHandle: string, message?: string) => {
  try {
    // REST запрос на backend
    const response = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_SEND, {
      method: 'POST',
      credentials: 'include', // Отправляем cookies с session
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toHandleValue: targetHandle, // handle получателя (например "@john")
        message: message, // опциональное сообщение
      }),
    });

    if (response.ok) {
      const result = await response.json();
      toast.success(`Request sent to ${targetHandle}`);
      // Закрыть модал
    } else {
      const error = await response.json();
      toast.error(error.message || 'Failed to send request');
    }
  } catch (error) {
    console.error('Error sending request:', error);
    toast.error('Network error');
  }
};
```

#### API Endpoint: `POST /contacts/requests`

**Запрос:**
```json
{
  "toHandleValue": "@john",
  "message": "Hey, let's connect!"
}
```

**Заголовки:**
```
Authorization: Bearer <access_token> (из cookies)
Content-Type: application/json
```

**Ответ (200 OK):**
```json
{
  "success": true,
  "requestId": "uuid-1234-5678",
  "message": "Contact request sent successfully"
}
```

**Возможные ошибки:**
```json
// 400 Bad Request
{
  "message": "Cannot send request to yourself"
}

// 404 Not Found
{
  "message": "Handle not found"
}

// 409 Conflict
{
  "message": "Contact request already exists"
}
```

### Backend: Обработка отправки

#### Controller: `contact-request.controller.ts`
```typescript
@Post('requests')
async sendRequest(
  @CurrentHandle() handle: any,  // Текущий handle отправителя (из JWT)
  @Body() dto: SendContactRequestDto
) {
  // Вызывает service для отправки запроса
  return await this.contactRequestService.sendRequest(
    handle.id,        // fromHandleId (отправитель)
    dto.toHandleValue, // target handle value
    dto.message       // опциональное сообщение
  );
}
```

#### Service: `contact-request.service.ts`
```typescript
async sendRequest(fromHandleId: string, toHandleValue: string, message?: string) {
  // 1. Найти целевой handle по value
  const toHandle = await this.handleRepository.findOne({
    where: { value: toHandleValue },
    relations: ['ownerIdentity', 'profile']
  });

  if (!toHandle) {
    throw new NotFoundException('Handle not found');
  }

  // 2. Проверить что не отправляем самому себе
  if (fromHandleId === toHandle.id) {
    throw new BadRequestException('Cannot send request to yourself');
  }

  // 3. Проверить что такого запроса уже нет
  const existingRequest = await this.contactRequestRepository.findOne({
    where: [
      { fromHandleId, toHandleId: toHandle.id },
      { fromHandleId: toHandle.id, toHandleId: fromHandleId }
    ]
  });

  if (existingRequest) {
    throw new ConflictException('Contact request already exists');
  }

  // 4. Создать и сохранить запрос
  const request = this.contactRequestRepository.create({
    fromHandleId,
    toHandleId: toHandle.id,
    message: message?.trim(),
    status: ContactRequestStatus.PENDING
  });

  const savedRequest = await this.contactRequestRepository.save(request);

  // 5. Загрузить аватар отправителя для WebSocket уведомления
  const fromHandle = await this.handleRepository.findOne({
    where: { id: fromHandleId },
    relations: ['ownerIdentity', 'profile']
  });
  const avatarUrl = await this.mediaService.getAvatarUrlIfExists(fromHandleId);

  // 6. Отправить WebSocket уведомление получателю
  await this.messagesGateway.notifyContactRequest(
    toHandle.id,  // toHandleId - кому отправляем уведомление
    { ...fromHandle, profile: { ...fromHandle.profile, avatarUrl } },
    savedRequest.id,
    message?.trim()
  );

  return { success: true, requestId: savedRequest.id };
}
```

#### Gateway: WebSocket отправка
```typescript
async notifyContactRequest(
  toHandleId: string,      // кому отправить
  fromHandle: any,         // данные о отправителе
  requestId: string,       // ID запроса
  message?: string         // опциональное сообщение
) {
  // 1. Создать уведомление в БД
  const notification = await this.notificationService.createNotification(
    toHandleId,
    'contact_request',
    {
      fromHandle: {
        id: fromHandle.id,
        value: fromHandle.value,
        displayName: fromHandle.profile?.displayName,
      },
      requestId,
      message,
    }
  );

  // 2. Отправить WebSocket события получателю
  // Событие 1: уведомление (для Inbox)
  this.server.to(`user:${toHandleId}`).emit('notification:created', notification);

  // Событие 2: контактный запрос (для модала)
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
```

### База данных: Создание записи

#### Таблица `contact_request`
```sql
INSERT INTO contact_request (id, from_handle_id, to_handle_id, message, status, created_at)
VALUES (
  'uuid-1234',
  'sender-handle-id',
  'receiver-handle-id',
  'Hey, let''s connect!',
  'PENDING',
  '2024-02-25 10:30:00'
);
```

#### Структура записи
```typescript
{
  id: string;                    // UUID контактного запроса
  fromHandleId: string;          // Handle отправителя
  toHandleId: string;            // Handle получателя
  message?: string;              // Опциональное сообщение
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Этап 2: Получатель видит запрос

### WebSocket событие: `contact_request_received`

#### Получение события на Frontend
```typescript
// Hook: use-websocket-notifications.tsx
socket.on('contact_request_received', (data) => {
  console.log('🔔 contact_request_received - showing modal:', data);
  
  const { requestId, fromHandle, message } = data;

  // Вызвать callback для отображения модала
  callbacksRef.current.onContactRequest?.({
    requestId,
    fromHandle: {
      id: fromHandle.id,
      value: fromHandle.value || fromHandle.handle,
      alias: fromHandle.alias || null,
      displayName: fromHandle.displayName,
      firstName: fromHandle.firstName || null,
      lastName: fromHandle.lastName || null,
      avatarUrl: fromHandle.avatarUrl || null,
      bio: fromHandle.bio || null,
    },
    message,
  });

  // Увеличить счетчик pending запросов
  incrementPending();
});
```

#### Обновление Store: `contact-requests-store-context.tsx`
```typescript
// Hook: use-contact-requests-sync.tsx
const handleContactRequestReceived = (data: ContactRequestData) => {
  console.log('📨 contact_request_received - adding to pending:', data);
  
  // Добавить в список входящих запросов
  addIncomingRequest({
    id: data.requestId,
    from: data.fromHandle,
    to: { handleId: '' },
    message: data.message,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  });

  // Сразу добавить в контакты (для отображения аватара)
  addContact({
    id: data.fromHandle.id,
    user: {
      id: data.fromHandle.id,
      displayName: data.fromHandle.displayName,
      handle: data.fromHandle.value,
      avatarUrl: data.fromHandle.avatarUrl,
    },
    acceptedAt: new Date().toISOString(),
  });
};

socket.on('contact_request_received', handleContactRequestReceived);
```

#### UI: Модал контактного запроса

```typescript
// routes/index.tsx
const handleContactRequest = useCallback((request: any) => {
  // Преобразовать данные из WebSocket в формат ContactRequest
  const transformedRequest = {
    id: request.requestId,
    from: {
      id: request.fromHandle.id,
      handleId: request.fromHandle.id,
      value: request.fromHandle.value,
      alias: request.fromHandle.alias,
      displayName: request.fromHandle.displayName,
      firstName: request.fromHandle.firstName,
      lastName: request.fromHandle.lastName,
      avatarUrl: request.fromHandle.avatarUrl,
      bio: request.fromHandle.bio,
    },
    message: request.message,
  };

  // Открыть модал
  setContactRequestModal({ isOpen: true, request: transformedRequest });
}, []);
```

#### Компонент модала
```typescript
// contact-request-modal.tsx
export function ContactRequestModal({
  isOpen,
  onClose,
  request,
  onAccept,
  onReject,
  loading,
}: ContactRequestModalProps) {
  if (!isOpen || !request) return null;

  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} title="Contact Request">
      <div className="flex flex-col items-center">
        {/* Аватар */}
        <Avatar className="h-20 w-20 mb-3">
          <AvatarFallback>{getInitials(request.from)}</AvatarFallback>
          {request.from?.avatarUrl && <AvatarImage src={request.from.avatarUrl} />}
        </Avatar>

        {/* Имя и handle */}
        <div className="text-lg font-semibold">{request.from?.displayName}</div>
        <div className="text-sm text-muted-foreground">
          @{request.from?.alias || request.from?.value}
        </div>

        {/* Биография */}
        {request.from?.bio && (
          <div className="text-sm text-muted-foreground text-center mt-4">
            {request.from.bio}
          </div>
        )}

        {/* Сообщение отправителя */}
        {request.message && (
          <div className="mb-4 p-3 bg-muted rounded-lg w-full">
            <div className="text-xs text-muted-foreground mb-1">Message:</div>
            <div className="text-sm">{request.message}</div>
          </div>
        )}

        {/* Кнопки действия */}
        <div className="flex space-x-2 w-full">
          <Button 
            className="flex-1" 
            onClick={() => onAccept(request)} 
            disabled={loading}
          >
            Accept
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onReject(request)}
            disabled={loading}
          >
            Reject
          </Button>
        </div>

        {/* Кнопка Later */}
        <Button 
          variant="ghost" 
          className="w-full mt-2" 
          onClick={onClose} 
          disabled={loading}
        >
          Later
        </Button>
      </div>
    </ResponsiveModal>
  );
}
```

#### Действия пользователя
1. **Later** - Закрыть модал, запрос остается в "Pending"
2. **Reject** - Отказать в добавлении
3. **Accept** - Принять запрос и создать чат

---

## Этап 3: Принятие запроса

### Действие пользователя: Нажимает "Accept"

#### Frontend: Отправка REST запроса
```typescript
// routes/index.tsx
const handleAcceptRequest = async (request: ContactRequest) => {
  setRequestActionLoading(true);
  try {
    // REST запрос на backend для принятия запроса
    const res = await fetch(
      API_ENDPOINTS.CONTACTS.REQUESTS_ACCEPT(request.id),
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (res.ok) {
      const result = await res.json();
      console.log('📡 Accept response:', result);
      
      // Закрыть модал
      setContactRequestModal({ isOpen: false, request: null });
      
      // Показать toast
      toast.success('Request accepted');

      // Данные из ответа API
      const fromHandle = result.fromHandle;
      const { chatId } = result;

      if (!fromHandle || !chatId) {
        toast.error('Invalid response from server');
        return;
      }

      // 1. Добавить контакт в store
      addContact({
        id: fromHandle.id,
        user: {
          id: fromHandle.id,
          displayName: fromHandle.displayName,
          handle: fromHandle.value,
          avatarUrl: fromHandle.avatarUrl,
          firstName: fromHandle.firstName,
          lastName: fromHandle.lastName,
          bio: fromHandle.bio,
        },
        acceptedAt: new Date().toISOString(),
      });

      // 2. Добавить чат в список
      const displayName = fromHandle.firstName && fromHandle.lastName
        ? `${fromHandle.firstName} ${fromHandle.lastName}`
        : fromHandle.displayName || `@${fromHandle.value}`;

      const newChatId = addChat({
        id: chatId,
        name: displayName,
        handleId: fromHandle.id,
        avatarUrl: fromHandle.avatarUrl,
        bio: fromHandle.bio,
        firstName: fromHandle.firstName,
        lastName: fromHandle.lastName,
        username: fromHandle.value,
        alias: fromHandle.alias,
      });

      // 3. Выбрать чат
      setSelectedChatId(newChatId);
      if (isMobile) {
        setCurrentView('chat');
      }
      // Примечание: reloadChats() не вызывается - чат уже добавлен через addChat()
      // Полная синхронизация происходит только при подключении (useChats hook)
    } else {
      toast.error('Failed to accept request');
    }
  } catch (error) {
    console.error('Error:', error);
    toast.error('Failed to accept request');
  } finally {
    setRequestActionLoading(false);
  }
};
```

#### API Endpoint: `POST /contacts/requests/{id}/accept`

**Параметры:**
```
/contacts/requests/uuid-1234/accept
```

**Ответ (200 OK):**
```json
{
  "success": true,
  "chatId": "chat-uuid-5678",
  "fromHandle": {
    "id": "sender-handle-id",
    "value": "@john",
    "displayName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://s3.amazonaws.com/...",
    "bio": "Software engineer",
    "alias": "johnny"
  }
}
```

### Backend: Обработка принятия

#### Controller
```typescript
@Post('requests/:id/accept')
@HttpCode(HttpStatus.OK)
async acceptRequest(
  @CurrentHandle() handle: any,
  @Param('id', ParseUUIDPipe) requestId: string
) {
  return await this.contactRequestService.acceptRequest(requestId, handle.id);
}
```

#### Service
```typescript
async acceptRequest(requestId: string, acceptorHandleId: string) {
  // 1. Найти запрос
  const request = await this.contactRequestRepository.findOne({
    where: {
      id: requestId,
      toHandleId: acceptorHandleId,
      status: ContactRequestStatus.PENDING
    },
    relations: [
      'fromHandle',
      'fromHandle.ownerIdentity',
      'fromHandle.profile',
      'toHandle.ownerIdentity',
      'toHandle.profile',
    ]
  });

  if (!request) {
    throw new NotFoundException('Contact request not found');
  }

  // 2. Обновить статус на ACCEPTED
  request.status = ContactRequestStatus.ACCEPTED;
  await this.contactRequestRepository.save(request);

  // 3. Создать или найти существующий приватный чат
  const chat = await this.chatRoomService.findOrCreatePrivateChat(
    request.fromHandleId,  // отправитель
    request.toHandleId     // принимающий
  );

  // 4. Загрузить аватар отправителя для WebSocket
  const avatarUrl = await this.mediaService.getAvatarUrlIfExists(request.fromHandle.id);

  // 5. Отправить WebSocket событие отправителю (триггер):
  //    "Твой запрос был принят!"
  //    Отправитель получает данные из WebSocket, принимающий из REST response
  await this.messagesGateway.notifyContactAccepted(
    request.fromHandleId,  // отправителю
    request.toHandle,
    chat.id
  );

  // Примечание: Принимающему (request.toHandleId) данные приходят из REST response,
  // а не из WebSocket. Так как он делал REST запрос POST /accept, он уже получил
  // полные данные (chatId, otherHandle с avatarUrl и т.д.)
  await this.messagesGateway.notifyNewChatAvailable(
    request.fromHandleId,  // отправителю
    request.toHandle,
    chat.id
  );

  // 8. Вернуть данные принимающему для обновления UI
  return {
    success: true,
    chatId: chat.id,
    fromHandle: {
      id: request.fromHandle.id,
      value: request.fromHandle.value,
      displayName: request.fromHandle.profile?.displayName,
      firstName: request.fromHandle.profile?.firstName,
      lastName: request.fromHandle.profile?.lastName,
      avatarUrl,  // Загруженный аватар
      bio: request.fromHandle.profile?.bio,
      alias: request.fromHandle.alias,
    },
  };
}
```

#### ChatRoomService
```typescript
async findOrCreatePrivateChat(
  fromHandleId: string,
  toHandleId: string
): Promise<Chat> {
  // 1. Найти существующий приватный чат между этими двумя handle'ами
  const existingChat = await this.chatRepository.createQueryBuilder('chat')
    .innerJoin('chat.members', 'member1',
      'member1.memberHandleId = :fromHandleId',
      { fromHandleId }
    )
    .innerJoin('chat.members', 'member2',
      'member2.memberHandleId = :toHandleId',
      { toHandleId }
    )
    .where('chat.type = :type', { type: 'private' })
    .getOne();

  if (existingChat) {
    return existingChat;
  }

  // 2. Если чата нет, создать новый
  const chat = this.chatRepository.create({
    type: 'private',
  });

  const savedChat = await this.chatRepository.save(chat);

  // 3. Добавить обоих в члены чата
  await this.chatMemberRepository.save([
    {
      chatId: savedChat.id,
      memberHandleId: fromHandleId,
    },
    {
      chatId: savedChat.id,
      memberHandleId: toHandleId,
    },
  ]);

  return savedChat;
}
```

### WebSocket события при принятии

#### Событие: `contact_accepted` (триггер для отправителя)
```typescript
async notifyContactAccepted(
  toHandleId: string,      // отправителю
  otherHandle: any,        // данные о принимающем
  chatId?: string
) {
  // Загрузить аватар принимающего
  const avatarUrl = otherHandle.id
    ? await this.mediaService.getAvatarUrlIfExists(otherHandle.id)
    : null;

  // Создать уведомление в БД
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

  // Отправить WebSocket события
  this.server.to(`user:${toHandleId}`).emit('notification:created', notification);
  
  // Основное событие - триггер для обновления UI
  this.server.to(`user:${toHandleId}`).emit('contact_accepted', {
    otherHandle: {
      id: otherHandle.id,
      displayName: otherHandle.profile?.displayName,
      handle: otherHandle.value,
      firstName: otherHandle.profile?.firstName || null,
      lastName: otherHandle.profile?.lastName || null,
      avatarUrl,  // ← аватар добавлен!
      bio: otherHandle.profile?.bio || null,
      alias: otherHandle.alias || null,
    },
    chatId,
    timestamp: new Date().toISOString(),
  });
}
```

**Примечание:** 
- Отправитель получает данные из этого WebSocket события (триггер для UI)
- Принимающий получает данные из REST response, не нуждается в WebSocket
- WebSocket = notification + состояние для отправителя

**Структура события:**
```typescript
{
  byHandle: {
    id: string;
    displayName: string;
    handle: string;
  };
  chatId: string;
  timestamp: string;
}
```

**Примечание:** `new_chat_available` событие было удалено как избыточное.
- Принимающий получает данные из REST response (не нуждается в WebSocket)
- Отправитель получает данные из `contact_accepted` события

#### Обработка события на Frontend

Отправитель получит данные через `contact_accepted` и вызовет:
- `addContact()` из WebSocket payload
- `addChat()` из WebSocket payload
- Показать toast уведомление

Принимающий получит данные из REST response и вызовет:
- `addContact()` из REST response
- `addChat()` из REST response
- Выбрать чат и перейти на него

**Структура события `contact_accepted`:**
```typescript
{
  fromHandle: {
    id: string;
    displayName: string;
    handle: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;  // ✅ Полный URL аватара
    bio: string | null;
    alias: string | null;
  };
  chatId: string;
  timestamp: string;
}
```

### Frontend: Обработка WebSocket событий

#### Обработка `contact_request_accepted`
```typescript
// use-websocket-notifications.tsx
socket.on('contact_request_accepted', data => {
  const { byHandle, chatId } = data;
  const displayName = byHandle.displayName || `@${byHandle.handle}` || 'Someone';

  console.log('✅ contact_request_accepted:', data);

  // Показать toast уведомление
  toast.success(`${displayName} accepted your request`, {
    description: 'You can now start chatting',
  });

  // Добавить в контакты
  removeOutgoingRequest(byHandle.id);
  addContact({
    id: byHandle.id,
    user: {
      id: byHandle.id,
      displayName: byHandle.displayName,
      handle: byHandle.handle,
      avatarUrl: byHandle.avatarUrl,
    },
    acceptedAt: new Date().toISOString(),
  });
});
```

#### Обработка `new_chat_available`
```typescript
// use-websocket-notifications.tsx
socket.on('new_chat_available', data => {
  const { fromHandle, chatId } = data;
  const displayName = fromHandle.displayName || `@${fromHandle.handle}` || 'Someone';

  console.log('🎉 new_chat_available:', data);

  // Показать toast
  toast.success(`Chat available with ${displayName}`, {
    description: 'You can now start messaging',
  });

  // Вызвать callback для добавления чата в UI
  callbacksRef.current.onNewChatAvailable?.(data);
});
```

```typescript
// routes/index.tsx
const handleNewChatAvailable = useCallback(
  (data: { fromHandle: any; chatId?: string }) => {
    console.log('💬 [SENDER] handleNewChatAvailable called with:', data);
    console.log('avatarUrl:', data.fromHandle?.avatarUrl);
    console.log('Current chats before add:', chats.length);

    if (!data.chatId) {
      console.warn('⚠️ No chatId in new_chat_available data');
      return;
    }

    // Создать displayName
    const displayName = data.fromHandle.firstName && data.fromHandle.lastName
      ? `${data.fromHandle.firstName} ${data.fromHandle.lastName}`
      : data.fromHandle.displayName || `@${data.fromHandle.handle}`;

    console.log('📍 Adding chat with displayName:', displayName, 'avatarUrl:', data.fromHandle.avatarUrl);

    // Добавить чат в список
    const chatId = addChat({
      id: data.chatId,
      name: displayName,
      handleId: data.fromHandle.id,
      avatarUrl: data.fromHandle.avatarUrl,  // ✅ Аватар из WebSocket
      bio: data.fromHandle.bio,
      firstName: data.fromHandle.firstName,
      lastName: data.fromHandle.lastName,
      username: data.fromHandle.handle,
      alias: data.fromHandle.alias,
    });

    console.log('✅ Chat added with ID:', chatId);
    console.log('Chats after add:', chats.length);

    // Примечание: reloadChats() не вызывается
    // Чат уже добавлен через addChat() из WebSocket данных
    // Полная синхронизация происходит только при подключении

    // На мобильной версии выбрать чат автоматически
    if (isMobile) {
      setSelectedChatId(chatId);
      setCurrentView('chat');
    }
  },
  [addChat, isMobile]
);
```

---

## Этап 4: Отказ или Later

### Действие 1: Later (Отложить)

Пользователь нажимает кнопку "Later" в модале.

#### Frontend
```typescript
// contact-request-modal.tsx
<Button 
  variant="ghost" 
  className="w-full mt-2" 
  onClick={onClose}  // Просто закрыть модал
  disabled={loading}
>
  Later
</Button>

// routes/index.tsx
onClose={() => setContactRequestModal({ isOpen: false, request: null })}
```

**Результат:**
- Модал закрывается
- Запрос остается в статусе `PENDING`
- Запрос остается в списке входящих запросов
- Backend не вызывается (чисто клиентская операция)

### Действие 2: Reject (Отказать)

Пользователь нажимает кнопку "Reject" в модале.

#### Frontend: Отправка REST запроса
```typescript
// routes/index.tsx
const handleRejectRequest = async (request: ContactRequest) => {
  setRequestActionLoading(true);
  try {
    const res = await fetch(
      API_ENDPOINTS.CONTACTS.REQUESTS_REJECT(request.id),
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    if (res.ok) {
      setContactRequestModal({ isOpen: false, request: null });
      toast.success('Request rejected');

      // Удалить из incoming requests
      removeIncomingRequest(request.id);

      // Удалить контакт (если был добавлен)
      if (request.from?.id) {
        removeContact(request.from.id);
      }
    } else {
      toast.error('Failed to reject request');
    }
  } catch (error) {
    console.error('Error:', error);
    toast.error('Failed to reject request');
  } finally {
    setRequestActionLoading(false);
  }
};
```

#### API Endpoint: `POST /contacts/requests/{id}/reject`

**Параметры:**
```
/contacts/requests/uuid-1234/reject
```

**Ответ (200 OK):**
```json
{
  "success": true
}
```

### Backend: Обработка отказа

#### Controller
```typescript
@Post('requests/:id/reject')
@HttpCode(HttpStatus.OK)
async rejectRequest(
  @CurrentHandle() handle: any,
  @Param('id', ParseUUIDPipe) requestId: string
) {
  return await this.contactRequestService.rejectRequest(requestId, handle.id);
}
```

#### Service
```typescript
async rejectRequest(requestId: string, rejectorHandleId: string) {
  // 1. Найти запрос
  const request = await this.contactRequestRepository.findOne({
    where: {
      id: requestId,
      toHandleId: rejectorHandleId,
      status: ContactRequestStatus.PENDING
    },
    relations: [
      'fromHandle',
      'fromHandle.ownerIdentity',
      'fromHandle.profile',
      'toHandle',
      'toHandle.ownerIdentity',
      'toHandle.profile',
    ]
  });

  if (!request) {
    throw new NotFoundException('Contact request not found');
  }

  // 2. Обновить статус на REJECTED
  request.status = ContactRequestStatus.REJECTED;
  await this.contactRequestRepository.save(request);

  // 3. Отправить WebSocket событие отправителю
  await this.messagesGateway.notifyRequestRejected(
    request.fromHandleId,  // отправителю
    request.toHandle
  );

  return { success: true };
}
```

#### Gateway: WebSocket отправка
```typescript
async notifyRequestRejected(toHandleId: string, byHandle: any) {
  // Создать уведомление
  const notification = await this.notificationService.createNotification(
    toHandleId,
    'contact_rejected',
    {
      fromHandle: {
        id: byHandle.id,
        value: byHandle.value,
        displayName: byHandle.profile?.displayName,
      },
    }
  );

  // Отправить события
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
```

### Frontend: Обработка отказа
```typescript
// use-websocket-notifications.tsx
socket.on('contact_request_rejected', data => {
  const { byHandle } = data;
  const displayName = byHandle.displayName || `@${byHandle.handle}` || 'Someone';

  console.log('❌ contact_request_rejected:', data);

  // Показать toast
  toast.error(`${displayName} declined your request`);

  // Удалить из outgoing requests
  removeOutgoingRequest(byHandle.id);

  // Удалить из контактов
  removeContact(byHandle.id);
});
```

---

## WebSocket события

### Полный список событий

#### События уведомлений
| Событие | Отправляется | Когда | Структура |
|---------|-------------|-------|-----------|
| `notification:created` | Server → Client | Когда создано уведомление | `{ id, type, read, data, timestamp }` |
| `notification:read` | Server → Client | Когда уведомление прочитано | `{ notificationId, unreadCount }` |
| `notification:all-read` | Server → Client | Когда все уведомления прочитаны | `{ unreadCount: 0 }` |
| `notifications:sync` | Server → Client | При подключении | `{ notifications[], unreadCount, timestamp }` |

#### События контактных запросов
| Событие | Отправляется | Кому | Когда |
|---------|-------------|------|-------|
| `contact_request_received` | Server → Client | Получателю | Новый запрос отправлен |
| `contact_request_accepted` | Server → Client | Отправителю | Запрос принят |
| `contact_request_rejected` | Server → Client | Отправителю | Запрос отклонен |
| `new_chat_available` | Server → Client | Обоим | Запрос принят, чат создан |

#### События статуса онлайн
| Событие | Отправляется | Когда |
|---------|-------------|-------|
| `user_online` | Server → Client | Пользователь подключился |
| `user_offline` | Server → Client | Пользователь отключился |

#### События сообщений
| Событие | Отправляется | Когда |
|---------|-------------|-------|
| `message:new` | Server → Client | Новое сообщение получено |
| `message:error` | Server → Client | Ошибка при отправке сообщения |

### Примеры WebSocket payload'ов

#### `contact_request_received`
```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "fromHandle": {
    "id": "handle-id-123",
    "value": "@john",
    "alias": "johnny",
    "displayName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://s3.example.com/avatars/john.jpg",
    "bio": "Software engineer",
    "handle": "@john"
  },
  "message": "Hey, let's connect!",
  "timestamp": "2024-02-25T10:30:00.000Z"
}
```

#### `contact_request_accepted`
```json
{
  "byHandle": {
    "id": "handle-id-456",
    "displayName": "Jane Smith",
    "handle": "@jane"
  },
  "chatId": "chat-id-789",
  "timestamp": "2024-02-25T10:35:00.000Z"
}
```

#### `new_chat_available`
```json
{
  "fromHandle": {
    "id": "handle-id-123",
    "displayName": "John Doe",
    "handle": "@john",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://s3.example.com/avatars/john.jpg",
    "bio": "Software engineer",
    "alias": "johnny"
  },
  "chatId": "chat-id-789",
  "timestamp": "2024-02-25T10:35:00.000Z"
}
```

#### `contact_request_rejected`
```json
{
  "byHandle": {
    "id": "handle-id-456",
    "displayName": "Jane Smith",
    "handle": "@jane"
  },
  "timestamp": "2024-02-25T10:40:00.000Z"
}
```

#### `notification:created`
```json
{
  "id": "notification-id-001",
  "type": "contact_request",
  "timestamp": "2024-02-25T10:30:00.000Z",
  "read": false,
  "data": {
    "fromHandle": {
      "id": "handle-id-123",
      "value": "@john",
      "displayName": "John Doe"
    },
    "requestId": "request-id-001",
    "message": "Hey, let's connect!"
  }
}
```

---

## REST API endpoints

### Контактные запросы

#### 1. Отправить контактный запрос
```http
POST /contacts/requests
Content-Type: application/json
Authorization: Bearer <token>

{
  "toHandleValue": "@john",
  "message": "Hey, let's connect!"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Ошибки:**
- `400` - Cannot send request to yourself / Invalid handle
- `404` - Handle not found
- `409` - Contact request already exists

---

#### 2. Получить входящие запросы
```http
GET /contacts/requests/incoming
Authorization: Bearer <token>
```

**Ответ (200):**
```json
{
  "requests": [
    {
      "id": "request-id-001",
      "from": {
        "id": "handle-id-123",
        "value": "@john",
        "displayName": "John Doe",
        "firstName": "John",
        "lastName": "Doe",
        "avatarUrl": "https://s3.example.com/avatars/john.jpg",
        "bio": "Software engineer",
        "alias": "johnny"
      },
      "message": "Hey, let's connect!",
      "status": "PENDING",
      "createdAt": "2024-02-25T10:30:00.000Z"
    }
  ]
}
```

---

#### 3. Получить исходящие запросы
```http
GET /contacts/requests/outgoing
Authorization: Bearer <token>
```

**Ответ (200):**
```json
{
  "requests": [
    {
      "id": "request-id-002",
      "from": {
        "id": "handle-id-456",
        "value": "@jane",
        "displayName": "Jane Smith"
      },
      "status": "PENDING",
      "createdAt": "2024-02-25T10:25:00.000Z"
    }
  ]
}
```

---

#### 4. Принять запрос
```http
POST /contacts/requests/{requestId}/accept
Authorization: Bearer <token>
```

**Ответ (200):**
```json
{
  "success": true,
  "chatId": "chat-id-789",
  "fromHandle": {
    "id": "handle-id-123",
    "value": "@john",
    "displayName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "avatarUrl": "https://s3.example.com/avatars/john.jpg",
    "bio": "Software engineer",
    "alias": "johnny"
  }
}
```

---

#### 5. Отказать в запросе
```http
POST /contacts/requests/{requestId}/reject
Authorization: Bearer <token>
```

**Ответ (200):**
```json
{
  "success": true
}
```

---

#### 6. Получить все контакты
```http
GET /contacts
Authorization: Bearer <token>
```

**Ответ (200):**
```json
{
  "contacts": [
    {
      "id": "contact-id-001",
      "user": {
        "id": "handle-id-123",
        "displayName": "John Doe",
        "handle": "@john",
        "avatarUrl": "https://s3.example.com/avatars/john.jpg",
        "firstName": "John",
        "lastName": "Doe",
        "bio": "Software engineer"
      },
      "acceptedAt": "2024-02-25T10:35:00.000Z"
    }
  ]
}
```

---

#### 7. Проверить статус запроса
```http
GET /contacts/status?otherHandleId=handle-id-123
Authorization: Bearer <token>
```

**Ответ (200):**
```json
{
  "status": "none" | "sent" | "received" | "connected"
}
```

Значения:
- `none` - нет запроса
- `sent` - мы отправили запрос
- `received` - нам отправили запрос
- `connected` - уже контакты

---

## Структуры данных

### ContactRequest (в БД)
```typescript
interface ContactRequest {
  id: string;                    // UUID
  fromHandleId: string;          // Handle отправителя
  toHandleId: string;            // Handle получателя
  message?: string;              // Опциональное сообщение
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}
```

### ContactRequest (Frontend)
```typescript
interface ContactRequest {
  id: string;
  from: {
    id: string;
    handleId?: string;
    value: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    alias?: string | null;
  };
  to?: {
    handleId: string;
  };
  message?: string;
  status?: string;
  createdAt?: string;
}
```

### Contact (Store)
```typescript
interface Contact {
  id: string;                    // Handle ID
  user: {
    id: string;
    displayName: string;
    handle: string;              // @username
    avatarUrl?: string | null;
    firstName?: string;
    lastName?: string;
    bio?: string;
  };
  acceptedAt: string;
}
```

### Chat
```typescript
interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  isOnline?: boolean;
  phone?: string;
  username?: string;
  publicKey?: string;
  handleId?: string;
  avatarUrl?: string;
  bio?: string;
  firstName?: string;
  lastName?: string;
  alias?: string;
}
```

---

## Диаграммы

### Диаграмма 1: Полный флоу отправки и принятия запроса

```
Пользователь A                          Backend                         Пользователь B
     │                                    │                                  │
     │  1. Вводит @john, нажимает        │                                  │
     │     "Send Request"                 │                                  │
     │                                    │                                  │
     ├─────────────────────────────────────→ POST /contacts/requests        │
     │                                    │                                  │
     │                              [Создать запрос]                        │
     │                              [Статус: PENDING]                       │
     │                                    │                                  │
     │                            [Загрузить аватар A]                      │
     │                                    │                                  │
     │                                    ├─────────────────────────────────→ WebSocket:
     │                                    │                                  contact_request_received
     │                                    │                                  {requestId, fromHandle, ...}
     │                                    │                                  │
     │                             ← 200 ← ← ← ← ← ← ← ← ← ←               │
     │ {success: true}                    │                          [Показать модал]
     │ Toast: "Request sent"              │                                  │
     │                                    │                                  │
     │                                    │                                  │
     │                                    │          Пользователь B         │
     │                                    │              нажимает            │
     │                                    │            "Accept"             │
     │                                    │                                  │
     │                                    ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←┤
     │                                    POST /contacts/requests/{id}/accept│
     │                                    │                                  │
     │                              [Обновить статус]                       │
     │                              [Статус: ACCEPTED]                      │
     │                                    │                                  │
     │                           [Создать/найти чат]                        │
     │                                    │                                  │
     │  ← ← ← ← ← ← ← ← ← ← ← ← ←  WebSocket:                             │
     │ contact_request_accepted           contact_request_accepted          │
     │ {byHandle, chatId}                 (не отправляется B)               │
     │ Toast: "John accepted"             │                                  │
     │                                    │                                  │
     │  ← ← ← ← ← ← ← ← ← ← ← ← ←  WebSocket:                             │
     │ new_chat_available                 new_chat_available                │
     │ {fromHandle, chatId}               {fromHandle, chatId}              │
     │                                    │                                  │
     │ [Добавить контакт]         [Добавить контакт]                       │
     │ [Добавить чат]             [Добавить чат]                           │
     │ [Выбрать чат]              [Выбрать чат]                            │
     │                                    │                                  │
     ├──→ ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←┤
     │                                    │                                  │
     │  Чат 1-в-1 готов                  │         Чат 1-в-1 готов          │
     │  Могут писать друг другу            │         Могут писать друг другу  │
     │                                    │                                  │
```

### Диаграмма 2: Флоу отказа

```
Пользователь A                          Backend                         Пользователь B
     │                                    │                                  │
     │                                    │ ← WebSocket:                    │
     │                                    │   contact_request_received      │
     │                                    │ {requestId, fromHandle, ...}    │
     │                                    │                                  │
     │                                    │                          [Показать модал]
     │                                    │                                  │
     │                                    │      Пользователь B             │
     │                                    │          нажимает               │
     │                                    │          "Reject"               │
     │                                    │                                  │
     │                                    ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←┤
     │                                    POST /contacts/requests/{id}/reject
     │                                    │                                  │
     │                              [Обновить статус]                       │
     │                              [Статус: REJECTED]                      │
     │                                    │                                  │
     │  ← ← ← ← ← ← ← ← ← ← ← ← ←  WebSocket:                             │
     │ contact_request_rejected           (Ответ API 200)                   │
     │ {byHandle}                         │                                  │
     │ Toast: "Jane declined"      [Закрыть модал]                          │
     │                             [Toast: "Request rejected"]               │
     │                                    │                                  │
     │ [Удалить из outgoing]              │                                  │
     │ [Удалить из контактов]             │                                  │
     │                                    │                                  │
```

### Диаграмма 3: Хранилище данных

```
PostgreSQL
├── contact_request
│   ├── id: UUID
│   ├── from_handle_id: UUID → handle.id
│   ├── to_handle_id: UUID → handle.id
│   ├── message: TEXT
│   ├── status: ENUM(PENDING, ACCEPTED, REJECTED)
│   ├── created_at: TIMESTAMP
│   └── updated_at: TIMESTAMP
│
├── chat
│   ├── id: UUID
│   ├── type: ENUM(private, group)
│   ├── created_at: TIMESTAMP
│   └── last_message_at: TIMESTAMP
│
├── chat_member
│   ├── id: UUID
│   ├── chat_id: UUID → chat.id
│   ├── member_handle_id: UUID → handle.id
│   └── joined_at: TIMESTAMP
│
├── notification
│   ├── id: UUID
│   ├── to_handle_id: UUID → handle.id
│   ├── type: ENUM(contact_request, contact_accepted, ...)
│   ├── read: BOOLEAN
│   ├── data: JSONB
│   ├── created_at: TIMESTAMP
│   └── ...
│
└── handle
    ├── id: UUID
    ├── value: VARCHAR (e.g., "@john")
    ├── owner_identity_id: UUID
    ├── profile: JSONB
    └── ...

Redis
├── online:<handleId> → "1" (TTL: 120s)
└── ...
```

---

## Обработка ошибок

### Сценарий 1: Сетевая ошибка при отправке запроса

```typescript
try {
  const res = await fetch(API_ENDPOINTS.CONTACTS.REQUESTS_SEND, {
    method: 'POST',
    // ...
  });
} catch (error) {
  // Сетевая ошибка (нет интернета, сервер не доступен)
  toast.error('Network error - please check your connection');
  console.error('Network error:', error);
  // Пользователь может повторить
}
```

### Сценарий 2: Запрос уже существует

```
Frontend → REST: POST /contacts/requests
Backend: 409 Conflict
{
  "message": "Contact request already exists"
}
Frontend: toast.error("Request already sent or exists")
```

### Сценарий 3: Отправитель отключился до WebSocket события

```
1. Пользователь B принимает запрос
2. Backend отправляет WebSocket события
3. Но Пользователь A уже отключился

Результат:
- сообщение не будет доставлено
- Данные все равно сохранены в БД
- Когда пользователь A подключится снова:
  - Он загрузит чаты через GET /chats
  - Чат будет в списке (уже создан)
  - Синхронизация произойдет
```

### Сценарий 4: Принятие запроса дважды (race condition)

```
Frontend 1: Клик на "Accept"
Frontend 2: Клик на "Accept" (одновременно)
Backend → DB: UPDATE contact_request SET status = 'ACCEPTED'

Результат:
- Первый запрос обновит статус на ACCEPTED
- Второй запрос вернет 404 (запрос уже не PENDING)
- Оба клиента получат правильный результат
```

---

## Правила и ограничения

### 1. На один контактный запрос
- Статус может быть только один из: PENDING, ACCEPTED, REJECTED
- Нельзя принять уже принятый запрос
- Нельзя отказать уже отклоненному запросу

### 2. На отношение между двумя handle'ами
- Максимум один активный запрос
- Если A отправил B, то B не может отправить A (пока не разрешится текущий)
- Если запрос отклонен, можно отправить новый

### 3. На WebSocket события
- События отправляются только если пользователь онлайн
- Если пользователь оффлайн, события буферизируются? **НЕТ**
- Когда пользователь подключится, он должен сам загрузить состояние

### 4. На аватары
- Аватар загружается через MediaService
- Если нет аватара, возвращается `null`
- Frontend отображает инициалы как fallback

---

## Оптимизации и будущие улучшения

### Текущие оптимизации (реализованные)
1. **Кэширование аватаров** - Загруженный аватар кэшируется в WebSocket payload
2. **REST как источник истины** - Все данные загружаются через REST API, WebSocket только для триггеров
3. **TTL для онлайн-статуса** - Redis автоматически очищает статус через 120s
4. **Контакт только при ACCEPTED** - Контакты добавляются только когда request статус = ACCEPTED
5. **Единый endpoint для запросов** - GET /contacts/requests?direction=incoming|outgoing|both
6. **Деduplication modals** - shownRequestIds предотвращает дублирование модалов в сессии
7. **Асинхронный addChat** - Чат добавляется сразу из REST response, без перезагрузки

### Возможные улучшения
1. **Индексы БД** - Добавить индексы на (fromHandleId, toHandleId, status)
2. **Пагинация** - Для GET /contacts/requests с большим числом запросов
3. **Фильтрация** - Фильтровать запросы по дате, типу
4. **Поиск** - Поиск по имени отправителя в списке запросов
5. **VIEWED статус в БД** - Вместо session-based shownRequestIds (для cross-device sync)
6. **Push-уведомления** - Push-уведомления если пользователь оффлайн

---

## Логирование и отладка

### Console logs на Frontend

```typescript
// Отправка запроса
console.log('📤 Sending contact request:', { toHandleId, message });

// Получение события
console.log('🔔 contact_request_received - showing modal:', data);
console.log('request.fromHandle:', request.fromHandle);

// Принятие запроса
console.log('📡 Accept response:', result);
console.log('fromHandle:', fromHandle);

// WebSocket события
console.log('✅ contact_request_accepted - showing notification:', data);
console.log('🎉 new_chat_available event received:', data);
console.log('avatarUrl:', fromHandle.avatarUrl);

// Обновление UI
console.log('💬 [SENDER] handleNewChatAvailable called with:', data);
console.log('Current chats before add:', chats.length);
console.log('✅ Chat added with ID:', chatId);
console.log('Chats after add:', chats.length);
```

### Server logs на Backend

```typescript
// Отправка запроса
console.log('Sending contact request from', fromHandleId, 'to', toHandle.id);

// Создание записи
console.log('Contact request created:', savedRequest.id);

// WebSocket отправка
console.log('🌐 Online status set for handle:', handleId);
console.log('📤 Emitting online status to handle:', contactHandleId);
```

---

## Заключение

Полный флоу контактных запросов включает:
1. **REST API** для синхронных операций (создание, принятие, отказ)
2. **WebSocket события** для real-time уведомлений
3. **Синхронизация состояния** между фронтенд и бэкенд
4. **Обработка ошибок** и edge cases
5. **Хранение данных** в PostgreSQL и уведомлений в Redis

Система обеспечивает надежную доставку уведомлений и правильное отображение контактов и чатов на обеих сторонах.
