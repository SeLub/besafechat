# 📄 Переключение Handle'ов: Архитектура и Реализация

**Версия**: 2.0  
**Дата**: Февраль 2026  
**Статус**: ✅ Реализовано  
**Язык**: Русский

---

## 1. Описание

Реализовать поддержку когда пользователь может быть онлайн с **разными handle'ами одновременно** (открыто несколько вкладок браузера):

```
User открывает:
- Tab1: Handle A (с одним набором чатов и контактов)
- Tab2: Handle B (с другим набором чатов и контактов)

Каждый handle = отдельная "личность" с полной изоляцией
Сообщения для Handle A идут только на Tab1
Сообщения для Handle B идут только на Tab2
```

---

## 2. Архитектура

### 2.1 Session Entity

```typescript
@Entity('sessions')
export class Session {
  id: UUID;
  identityId: UUID;
  handleId: UUID;  // ✅ Какой handle эта сессия
  socketId: string;  // Текущий WebSocket socket.io id
  deviceName: string;
  // ... остальные поля
  
  // ❌ УДАЛИТЬ isActive флаг (не нужен)
}
```

### 2.2 WebSocket маршрутизация

```
Каждый WebSocket присоединяется к комнате по handle'у:

Tab1 (Handle A):
  WebSocket1 → join('user:A')

Tab2 (Handle B):
  WebSocket2 → join('user:B')

Входящее сообщение для Handle A:
  Server.to('user:A').emit('message:new', ...)
  ✅ WebSocket1 (Tab1) получит
  ❌ WebSocket2 (Tab2) не в канале

Входящее сообщение для Handle B:
  Server.to('user:B').emit('message:new', ...)
  ❌ WebSocket1 (Tab1) не в канале
  ✅ WebSocket2 (Tab2) получит
```

### 2.3 Логика переключения handle'а

```
User в Tab1 (Handle A) нажимает "Switch to Handle B":

Шаг 1: POST /auth/sessions/switch-handle/handleB
       
Шаг 2: Backend проверяет
       SELECT * FROM sessions 
       WHERE identityId=X AND handleId=B AND revoked=false
       
Шаг 3a: Если НЕ найдена → CREATE новую сессию
        Session2: identityId=X, handleId=B
        Выдать новые cookies
        
Шаг 3b: Если найдена → использовать существующую
        Session2 уже есть (может быть открыта в фоне)
        Выдать cookies для Session2
        
Шаг 4: WebSocket переподключается
       leave('user:A')
       join('user:B')
       (или может быть новое соединение)
```

### 2.4 Несколько вкладок одного handle'а

```
Tab1 (Handle A, WebSocket1)
Tab2 (Handle A, WebSocket2)  ← новая вкладка того же handle

Шаг 1: При подключении WebSocket2
       SELECT * FROM sessions 
       WHERE identityId=X AND handleId=A
       
Шаг 2: Если Session1 уже есть → переиспользуем
       WebSocket2 присоединяется к существующей Session1
       
Результат:
  Session1: handleId=A
    WebSocket1 (Tab1) → user:A
    WebSocket2 (Tab2) → user:A
    
Входящее сообщение для Handle A:
  Server.to('user:A').emit(...)
  ✅ Получат оба WebSocket
```

---

## 3. Backend реализация

### 3.1 Session Entity (только удаление)

**Файл**: `backend/src/domains/session/session.entity.ts`

```typescript
@Entity('sessions')
@Index('idx_sessions_handle', ['identityId', 'handleId'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  identityId!: string;

  // ✅ Который handle эта сессия
  @Column({ type: 'uuid' })
  handleId!: string;

  // ✅ Текущий WebSocket socket.io id
  @Column({ type: 'varchar', nullable: true })
  socketId?: string;

  @Column({ type: 'varchar', length: 100 })
  deviceName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType?: 'mobile' | 'desktop' | 'web';

  @Column({ type: 'varchar', nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', unique: true })
  accessTokenHash!: string;

  @Column({ type: 'text', unique: true })
  refreshToken!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 3.2 MessagesGateway

**Файл**: `backend/src/domains/message/gateways/messages.gateway.ts`

#### handleConnection()

```typescript
async handleConnection(client: Socket) {
  try {
    console.log('🔌 WebSocket connection attempt');

    // Валидация и получение сессии
    const cookieHeader = client.handshake.headers.cookie;
    const accessToken = cookieHeader
      ?.split('; ')
      .find(p => p.startsWith('access_token='))
      ?.split('=')[1];

    if (!accessToken) {
      client.disconnect(true);
      return;
    }

    const session = await this.sessionService.validateAccessToken(accessToken);
    if (!session || session.revoked) {
      client.disconnect(true);
      return;
    }

    // Сохраняем в socket.data
    client.data.identityId = session.identity.id;
    client.data.sessionId = session.id;
    client.data.handleId = session.handleId;

    console.log(
      `👤 Connected: identity=${session.identity.id}, handle=${session.handleId}, socket=${client.id}`
    );

    // ✅ Присоединить к комнате handle'а
    if (session.handleId) {
      await client.join(`user:${session.handleId}`);
      console.log(`🚪 Joined room: user:${session.handleId}`);
    }

    // Уведомить контакты об онлайн-статусе
    await this.notifyContactsUserOnline(session.handleId);

    // Синхронизировать уведомления
    await this.syncNotifications(client, session.handleId);
  } catch (error) {
    console.error('❌ Connection error:', error);
    client.disconnect(true);
  }
}
```

#### handleDisconnect()

```typescript
async handleDisconnect(client: Socket) {
  if (client.data?.handleId) {
    try {
      // Уведомить контакты об офлайн-статусе
      await this.notifyContactsUserOffline(client.data.handleId);
      console.log(`✅ Disconnected: handle=${client.data.handleId}`);
    } catch (error) {
      console.error('❌ Error on disconnect:', error);
    }
  }
}
```

#### handleMessage() - маршрутизация по handle'у

```typescript
@SubscribeMessage('message')
async handleMessage(client: Socket, payload: MessagePayloadDto) {
  try {
    const { to, type, encryptedContent, encryptedKey, timestamp } = payload;

    console.log(
      `📨 Message: from=${client.data.handleId}, to=${to}, type=${type}`
    );

    // 1️⃣ Сохранить метаданные
    const { chatId, messageId } = await this.messageMetadataService.save(
      client.data.handleId,
      to,
      payload
    );

    // 2️⃣ ✅ Отправить на все WebSocket'ы в комнате handle'а получателя
    // (может быть несколько вкладок одного браузера с этим handle'ом)
    this.server.to(`user:${to}`).emit('message:new', {
      id: messageId,
      from: client.data.handleId,
      chatId,
      type,
      encryptedContent,
      encryptedKey,
      timestamp,
    });

    console.log(
      `✅ Message emitted to room: user:${to} (все вкладки этого handle'а)`
    );
  } catch (error) {
    console.error('❌ Message handling error:', error);
    client.emit('message:error', { error: 'Failed to send message' });
  }
}
```

### 3.3 Добавить endpoint: переключение handle'а

**Файл**: `backend/src/domains/auth/controllers/auth-session.controller.ts`

```typescript
/**
 * POST /auth/sessions/switch-handle/:handleId
 * 
 * Переключить активный handle пользователя.
 * 
 * Логика:
 * 1. Проверить есть ли уже сессия для этого handle
 * 2. Если ДА → использовать существующую (UPDATE socketId)
 * 3. Если НЕТ → создать новую сессию
 * 4. Выдать новые cookies с новой сессией
 */
@Post('sessions/switch-handle/:handleId')
@UseGuards(JwtSessionGuard)
@HttpCode(HttpStatus.OK)
async switchToHandle(
  @CurrentUser() user: AuthenticatedUser,
  @Param('handleId') handleId: string,
  @Req() req: AuthenticatedRequest,
  @Res({ passthrough: true }) res: ResponseWithCookies
) {
  if (!handleId) {
    throw new BadRequestException('Handle ID is required');
  }

  console.log(
    `🔄 Switch handle: identity=${user.identityId}, from=${user.sessionId}, to=${handleId}`
  );

  // 1️⃣ Валидировать handle
  const handle = await this.handleService.findById(handleId);
  if (!handle || handle.ownerIdentityId !== user.identityId) {
    throw new BadRequestException('Invalid handle or does not belong to user');
  }

  // 2️⃣ Проверить есть ли уже сессия для этого handle
  const existingSession = await this.sessionRepository.findOne({
    where: {
      identityId: user.identityId,
      handleId: handleId,
      revoked: false,
    },
  });

  let targetSession: Session;

  if (existingSession) {
    console.log(
      `✅ Found existing session ${existingSession.id} for handle ${handleId}`
    );
    targetSession = existingSession;
    // Можно обновить socketId и lastActiveAt если нужно
    await this.sessionRepository.update(
      { id: existingSession.id },
      { lastActiveAt: new Date() }
    );
  } else {
    console.log(
      `📝 Creating new session for handle ${handleId}`
    );
    // 3️⃣ Создать новую сессию
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req as any).headers?.['user-agent'] || 'Unknown device';
    const deviceName = userAgent.substring(0, 100);

    const result = await this.sessionService.createSession(
      user.identityId,
      deviceName,
      undefined, // deviceType
      ipAddress,
      undefined, // userAgent
      handleId   // ← новый handle
    );

    targetSession = result.session;

    // ✅ Обновить cookies новыми токенами
    this.setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

    console.log(`✅ Created new session ${targetSession.id} for handle ${handleId}`);
  }

  return new ApiResponseDto(true, {
    sessionId: targetSession.id,
    handleId: targetSession.handleId,
    message: 'Switched to handle successfully',
  });
}

private setAuthCookies(
  res: ResponseWithCookies,
  accessToken: string,
  refreshToken: string
) {
  const isHttps = process.env.HTTPS === 'true';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isHttps,
    maxAge: 30 * 60 * 1000,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isHttps,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });
}
```

---

## 4. Frontend реализация

### 4.1 Переключение handle'а

**Файл**: `frontend/app/services/auth.service.ts`

```typescript
/**
 * Переключить активный handle
 * 
 * Логика:
 * 1. POST на сервер
 * 2. Сервер проверяет есть ли сессия для этого handle
 * 3. Если есть → используем, если нет → создает новую
 * 4. Выдаёт новые cookies
 * 5. WebSocket переподключается автоматически
 */
static async switchToHandle(
  handleId: string
): Promise<{ sessionId: string; handleId: string }> {
  const res = await fetch(
    `${this.API_BASE}/auth/sessions/switch-handle/${handleId}`,
    {
      method: 'POST',
      credentials: 'include',
    }
  );

  if (!res.ok) {
    const error = await res.text().catch(() => 'Unknown error');
    throw new Error(`Failed to switch handle: ${error}`);
  }

  const data: ApiResponse<{
    sessionId: string;
    handleId: string;
    message: string;
  }> = await res.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to switch handle');
  }

  return {
    sessionId: data.data.sessionId,
    handleId: data.data.handleId,
  };
}
```

### 4.2 Использование в компоненте

**Файл**: `frontend/app/components/handle-switcher-modal.tsx`

```typescript
const handleSwitchClick = async (handleId: string) => {
  try {
    setIsLoading(true);
    const result = await AuthService.switchToHandle(handleId);
    
    // Обновить контекст
    updateAuthContext({
      sessionId: result.sessionId,  // ← может измениться
      activeHandleId: result.handleId,
    });
    
    // WebSocket переподключится автоматически
    // (новые cookies → новая сессия → новое подключение)
    
    console.log('✅ Switched to handle:', result.handleId);
    onClose();
  } catch (error) {
    console.error('❌ Error switching handle:', error);
    toast.error('Failed to switch handle');
  } finally {
    setIsLoading(false);
  }
};
```

---

## 5. Сценарии использования

### Сценарий 1: Одна вкладка, переключение handle'ов

```
Tab1: Handle A

User: "Switch to Handle B"
  ↓
POST /auth/sessions/switch-handle/handleB
  ↓
SELECT sessions WHERE identityId=X AND handleId=B
  
  Не найдена:
    CREATE новую Session2
    Выдать новые cookies
    
  Найдена:
    Использовать Session2
    Выдать cookies от Session2
  ↓
WebSocket переподключается
  ↓
Tab1 теперь показывает Handle B
```

### Сценарий 2: Две вкладки разных handle'ов

```
Tab1: Handle A → WebSocket1 → user:A
Tab2: Handle B → WebSocket2 → user:B

Входящее сообщение для Handle A:
  Server.to('user:A').emit(...)
  → WebSocket1 получит
  → WebSocket2 не получит (не в канале)
  
Входящее сообщение для Handle B:
  Server.to('user:B').emit(...)
  → WebSocket1 не получит (не в канале)
  → WebSocket2 получит
```

### Сценарий 3: Две вкладки одного handle'а

```
Tab1: Handle A → WebSocket1 → user:A
Tab2: Handle A → WebSocket2 → user:A  (переиспользуем Session1)

Входящее сообщение для Handle A:
  Server.to('user:A').emit(...)
  → WebSocket1 получит
  → WebSocket2 получит
  ✅ Оба получат одно сообщение
```

---

## 6. Тестирование

### Тест 1: Переключение handle'а на одной вкладке

```
1. Открыть браузер, залогиниться (Handle A)
2. Нажать "Switch to Handle B"
3. Проверить:
   - ✅ В БД новая сессия (или обновлена существующая)
   - ✅ Cookies обновлены
   - ✅ UI показывает Handle B
   - ✅ Чаты/контакты for Handle B
```

### Тест 2: Две вкладки разных handle'ов

```
1. Tab1: Handle A
2. Tab2: Handle B
3. Отправить сообщение для Handle A
4. Проверить:
   - ✅ Tab1 получит сообщение
   - ✅ Tab2 не получит (может остаться в Redis)
```

### Тест 3: Две вкладки одного handle'а

```
1. Tab1: Handle A
2. Tab2: Handle A (переиспользуется Session1)
3. Отправить сообщение для Handle A
4. Проверить:
   - ✅ Tab1 получит сообщение
   - ✅ Tab2 получит то же сообщение
```

---

## 7. Файлы для изменения

### Backend

- `backend/src/domains/session/session.entity.ts` - удалить isActive
- `backend/src/domains/message/gateways/messages.gateway.ts` - обновить логику
- `backend/src/domains/auth/controllers/auth-session.controller.ts` - добавить endpoint

### Frontend

- `frontend/app/services/auth.service.ts` - обновить switchToHandle
- `frontend/app/components/handle-switcher-modal.tsx` - использование

---

## 8. Статус Реализации

✅ **Статус**: РЕАЛИЗОВАНО  

### Backend Changes
- ✅ Session Entity: сделан `activeHandleId` required, удален `isActive`
- ✅ SessionService: добавлен метод `switchToHandle()` с логикой переиспользования сессий
- ✅ AuthSessionController: добавлен endpoint `POST /auth/sessions/switch-handle/{handleId}`
- ✅ MessagesGateway: уже корректно маршрутизирует сообщения по `activeHandleId`

### Frontend Changes
- ✅ AuthService: обновлен `switchToHandle()` для использования нового endpoint
- ✅ DeviceService: добавлен метод `getUserAgent()` для единообразия

### Фиксы
- ✅ Единообразный формат `deviceName` везде: полный `user-agent` из headers
- ✅ Рефакторинг revoke логики в IdentityService (удален `isActive`)

**Дата реализации**: 27 февраля 2026  
**Объем**: ~4 часа  
**Сложность**: 🟢 Средняя
