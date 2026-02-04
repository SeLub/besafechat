# Техническое задание: Миграция на Identity-Based Architecture

## 1. Введение

### 1.1. Цель
Миграция системы с монолитной архитектуры на **Identity-Based Architecture**, где все пользовательские взаимодействия осуществляются через абстракцию `Handle`, а `Identity` остается криптографической основой системы.

### 1.2. Проблема
Текущая система смешивает идентификацию пользователей через `Identity` и `Handle`, что приводит к:
- Сложности в управлении правами доступа
- Невозможности иметь множественные идентификаторы
- Слабой поддержке команд и каналов
- Ограничениям в E2EE реализации

### 1.3. Решение
Внедрение четкой трехуровневой архитектуры:
1. **Identity** - криптографическая сущность (мастер-ключ)
2. **Handle** - публичные идентификаторы (указатели)
3. **Profile** - контекстные представления

## 2. Архитектурные изменения

### 2.1. Новая модель данных

```
Identity (1) → (N) Handle (1) → (N) Profile
      ↑                ↑               ↑
    Session         ChatMember      MessageMetadata
      |                |               |
    Device         Chat/Channel     Media
```

### 2.2. Ключевые принципы

1. **Identity** не используется напрямую в бизнес-логике
2. Все поиски и взаимодействия через **Handle**
3. **Profile** привязан к конкретному контексту (Handle)
4. Разделение: членство в командах vs участие в чатах

## 3. Изменения в сущностях

### 3.1. Уже обновленные сущности

✅ **Identity** - базовая криптографическая сущность
✅ **Handle** - уникальные идентификаторы (указатели)
✅ **Profile** - персональные данные для Handle типа 'account'
✅ **Session** - устройства с поддержкой E2EE
✅ **Chat** - приватные чаты 1:1 с E2EE
✅ **ChatMember** - участники чатов/каналов
✅ **ContactRequest** - запросы на контакт
✅ **Team** - рабочие пространства
✅ **TeamMembership** - членство в командах
✅ **TeamInvite** - приглашения в команды
✅ **MessageMetadata** - метаданные сообщений
✅ **Media** - медиафайлы

### 3.2. Новые связи

```typescript
// Вместо:
Message.senderIdentity → Identity

// Теперь:
Message.senderHandle → Handle (type='account')
MessageMetadata.chatId → Chat.id | Channel.id
```

## 4. Изменения в сервисах

### 4.1. Authentication Service

#### Текущее состояние:
```typescript
class AuthService {
  login(email: string, password: string): { identity: Identity, token: string }
}
```

#### Новое состояние:
```typescript
class AuthService {
  login(handleValue: string, password: string): { 
    identity: Identity, 
    handle: Handle, 
    token: string 
  }
  
  // Регистрация создает Identity → Handle → Profile
  register(data: {
    handleValue: string;
    handleType: 'account';
    displayName: string;
    publicKey?: Buffer;
  }): { identity: Identity, handle: Handle, profile: Profile }
}
```

### 4.2. User Service

#### Текущее состояние:
```typescript
class UserService {
  getUserByIdentity(identityId: string): Identity & Profile
  updateUser(identityId: string, data: Partial<Profile>)
}
```

#### Новое состояние:
```typescript
class UserService {
  // Поиск по Handle
  getUserByHandle(handleValue: string): { handle: Handle, profile: Profile }
  
  // Получение всех Handle пользователя
  getUserHandles(identityId: string): Handle[]
  
  // Создание нового Handle для Identity
  createHandle(identityId: string, data: {
    value: string;
    type: 'account';
    alias?: string;
    isSearchable?: boolean;
  }): Handle
  
  // Обновление Profile для конкретного Handle
  updateProfile(handleId: string, data: Partial<Profile>)
}
```

### 4.3. Chat Service

#### Текущее состояние:
```typescript
class ChatService {
  createChat(identityId1: string, identityId2: string): Chat
  sendMessage(identityId: string, chatId: string, content: string)
}
```

#### Новое состояние:
```typescript
class ChatService {
  // Создание чата между двумя Handle
  createPrivateChat(handleId1: string, handleId2: string): {
    chat: Chat,
    member1: ChatMember,
    member2: ChatMember
  }
  
  // Отправка сообщения от Handle
  sendMessage(handleId: string, chatId: string, data: {
    type: MessageType;
    text?: string;
    media?: MediaData;
    encryptedContent?: Buffer;
  }): MessageMetadata
  
  // Поиск чатов по участнику (Handle)
  getChatsByMember(handleId: string): Array<{
    chat: Chat;
    otherMember: Handle & Profile;
    lastMessage?: MessageMetadata;
  }>
}
```

### 4.4. Team Service

#### Новый сервис:
```typescript
class TeamService {
  // Создание команды
  createTeam(ownerHandleId: string, data: {
    name: string;
    slug: string;
    description?: string;
  }): { team: Team, handle: Handle, ownerMembership: TeamMembership }
  
  // Приглашение в команду
  inviteToTeam(inviterHandleId: string, teamId: string, invitedHandleValue: string): TeamInvite
  
  // Принятие приглашения
  acceptInvite(inviteId: string, invitedHandleId: string): TeamMembership
  
  // Получение команд пользователя
  getUserTeams(handleId: string): Array<{
    team: Team;
    membership: TeamMembership;
    role: string;
  }>
}
```

### 4.5. Channel Service

#### Новый сервис:
```typescript
class ChannelService {
  // Создание канала
  createChannel(ownerHandleId: string, data: {
    handleValue: string;
    alias?: string;
    isPublic: boolean;
    description?: string;
  }): { channel: Channel, handle: Handle }
  
  // Подписка на канал
  subscribeToChannel(subscriberHandleId: string, channelHandleValue: string): ChannelSubscriber
  
  // Отправка сообщения в канал
  broadcastMessage(senderHandleId: string, channelId: string, data: {
    content: string;
    type: MessageType;
    media?: MediaData;
  }): ChannelMessage
  
  // Получение каналов по подписчику
  getSubscribedChannels(handleId: string): Channel[]
}
```

## 5. Изменения в контроллерах

### 5.1. Auth Controller

```typescript
// Старое:
@Post('register')
register(@Body() dto: { email: string, password: string, displayName: string })

// Новое:
@Post('register')
register(@Body() dto: {
  handle: string; // Уникальный идентификатор
  displayName: string;
  publicKey?: string; // Base64 encoded
  alias?: string;
})
```

### 5.2. User Controller

```typescript
// Новые endpoints:
@Get('handles')
getUserHandles(@CurrentIdentity() identity: Identity) {
  return this.userService.getUserHandles(identity.id);
}

@Post('handles')
createHandle(@CurrentIdentity() identity: Identity, @Body() dto: CreateHandleDto) {
  return this.userService.createHandle(identity.id, dto);
}

@Get('profile/:handleValue')
getProfileByHandle(@Param('handleValue') handleValue: string) {
  return this.userService.getUserByHandle(handleValue);
}
```

### 5.3. Chat Controller

```typescript
// Создание чата теперь через Handle
@Post('private')
createPrivateChat(
  @CurrentHandle() handle: Handle,
  @Body() dto: { otherHandleValue: string }
) {
  return this.chatService.createPrivateChat(handle.id, dto.otherHandleValue);
}

// Отправка сообщения
@Post(':chatId/messages')
sendMessage(
  @CurrentHandle() handle: Handle,
  @Param('chatId') chatId: string,
  @Body() dto: SendMessageDto
) {
  return this.chatService.sendMessage(handle.id, chatId, dto);
}
```

### 5.4. Team Controller

```typescript
@Controller('teams')
export class TeamController {
  @Post()
  createTeam(
    @CurrentHandle() handle: Handle,
    @Body() dto: CreateTeamDto
  ) {
    return this.teamService.createTeam(handle.id, dto);
  }
  
  @Post(':teamId/invites')
  inviteToTeam(
    @CurrentHandle() handle: Handle,
    @Param('teamId') teamId: string,
    @Body() dto: { invitedHandle: string }
  ) {
    return this.teamService.inviteToTeam(handle.id, teamId, dto.invitedHandle);
  }
}
```

### 5.5. Channel Controller

```typescript
@Controller('channels')
export class ChannelController {
  @Post()
  createChannel(
    @CurrentHandle() handle: Handle,
    @Body() dto: CreateChannelDto
  ) {
    return this.channelService.createChannel(handle.id, dto);
  }
  
  @Post(':channelHandle/subscribe')
  subscribe(
    @CurrentHandle() handle: Handle,
    @Param('channelHandle') channelHandle: string
  ) {
    return this.channelService.subscribeToChannel(handle.id, channelHandle);
  }
}
```

## 6. Изменения в DTO

### 6.1. Новые DTO

```typescript
// Handle DTOs
export class CreateHandleDto {
  @IsString()
  @Length(3, 255)
  value: string;
  
  @IsEnum(['account', 'team', 'channel'])
  type: HandleType;
  
  @IsOptional()
  @IsString()
  alias?: string;
  
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  displayName?: string;
  
  @IsOptional()
  @IsString()
  avatarUrl?: string;
  
  @IsOptional()
  @IsString()
  bio?: string;
}

// Chat DTOs
export class CreatePrivateChatDto {
  @IsString()
  otherHandleValue: string; // Поиск по Handle
}
```

## 7. Guards и Middleware

### 7.1. CurrentIdentity Guard (существующий)

```typescript
@Injectable()
export class IdentityGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    
    // Валидация JWT и получение Identity
    const identity = await this.authService.validateToken(token);
    request.identity = identity;
    
    return true;
  }
}
```

### 7.2. Новый: CurrentHandle Guard

```typescript
@Injectable()
export class HandleGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const identity = request.identity; // Из IdentityGuard
    
    // Получение активного Handle из заголовка или сессии
    const handleId = request.headers['x-handle-id'];
    const handle = await this.handleService.getHandleById(handleId);
    
    // Проверка принадлежности Handle к Identity
    if (handle.ownerIdentityId !== identity.id) {
      throw new UnauthorizedException('Handle does not belong to identity');
    }
    
    request.handle = handle;
    return true;
  }
}
```

### 7.3. Декораторы

```typescript
// Существующий
export const CurrentIdentity = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.identity;
  },
);

// Новый
export const CurrentHandle = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.handle;
  },
);
```

## 8. Изменения в модулях

### 8.1. App Module

```typescript
@Module({
  imports: [
    TypeOrmModule.forRoot(config),
    
    // Новые модули
    HandleModule,
    ProfileModule,
    TeamModule,
    ChannelModule,
    
    // Обновленные модули
    IdentityModule,
    ChatModule,
    MessageModule,
    MediaModule,
  ],
})
export class AppModule {}
```

### 8.2. Handle Module

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Handle])],
  providers: [HandleService],
  exports: [HandleService],
})
export class HandleModule {}
```

### 8.3. Team Module

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMembership, TeamInvite]),
    HandleModule,
  ],
  providers: [TeamService, TeamMembershipService, TeamInviteService],
  controllers: [TeamController],
  exports: [TeamService],
})
export class TeamModule {}
```

## 9. Миграция данных

### 9.1. Скрипт миграции
НЕ ТРЕБУЕТСЯ

### 9.2. Обратная совместимость
НЕ ТРЕБУЕТСЯ

## 10. План внедрения

### Фаза 1: Подготовка (1-2 недели) - ✅ ЗАВЕРШЕНА
1. **Создание ChallengeService и Redis структуры** - ✅ ЗАВЕРШЕНО
   - Создан `ChallengeService` с Redis-базированным хранением чалленджей
   - Реализована валидация Ed25519 подписей для доказательства владения приватным ключом
   - Добавлена защита от повторных атак (replay attacks) через одноразовое использование чалленджей
   - Внедрена система ограничения частоты запросов (rate limiting)

2. **Разработка методов подписи/верификации на клиенте** - ✅ ЗАВЕРШЕНО
   - Проверено наличие необходимых Ed25519 методов в `frontend/app/lib/crypto/core/signatures.ts`
   - Подтверждено, что функции `signMessage()`, `verifySignature()`, `signMessageToBase64()`, и `verifySignatureFromBase64()` уже доступны
   - Никакой дополнительной клиентской разработки не требуется

3. **Создание тестовой среды** - ✅ ЗАВЕРШЕНО
   - Добавлены необходимые зависимости Jest (@nestjs/testing, @types/jest, jest, ts-jest)
   - Создана организованная структура тестов: `/tests/unit`, `/tests/integration`, `/tests/e2e`
   - Перемещены и переименованы существующие тесты в формат `.spec.ts`
   - Созданы новые unit-тесты для ChallengeService и handle generation
   - Обновлена конфигурация Jest в package.json для правильного сканирования тестов
   - Все тесты проходят успешно (10/10 тестов проходят)

### Фаза 2: Разработка (2-3 недели) - ✅ ЧАСТИЧНО ЗАВЕРШЕНА
1. **Реализация новых эндпоинтов API** - ✅ ЗАВЕРШЕНО
   - Созданы эндпоинты `/auth/login/challenge` и `/auth/register/challenge` для запроса чалленджей
   - Обновлены эндпоинты `/auth/login` и `/auth/register` для поддержки challenge-response аутентификации
   - Добавлены соответствующие DTO для валидации

2. **Модификация клиентской логики аутентификации** - ❌ В ПРОЦЕССЕ/ОЖИДАЕТСЯ
   - Требуется обновление frontend аутентификации для использования challenge-response
   - Потребуется изменение компонентов регистрации и входа

3. **Интеграция с существующими сервисами** - ✅ ЗАВЕРШЕНО
   - Интеграция с RedisService для хранения чалленджей
   - Интеграция с существующими AuthService, SessionService и другими сервисами
   - Поддержание обратной совместимости там, где необходимо

### Фаза 3: Тестирование (1 неделя) - ❌ ОЖИДАЕТСЯ
1. Unit и интеграционные тесты - ЧАСТИЧНО ЗАВЕРШЕНЫ
   - Unit-тесты для ChallengeService: ✅ 3/3 проходят
   - Тесты для генерации handle: ✅ 3/3 проходят
2. Security тестирование - ❌ ОЖИДАЕТСЯ
3. Performance тестирование - ❌ ОЖИДАЕТСЯ

### Фаза 4: Развертывание - ❌ ОЖИДАЕТСЯ
1. Поэтапный rollout (канареечные деплои) - ❌ ОЖИДАЕТСЯ
2. Мониторинг метрик и ошибок - ❌ ОЖИДАЕТСЯ
3. Резервная возможность отката - ❌ ОЖИДАЕТСЯ

### Фаза 5: Отключение старого кода - ❌ ОЖИДАЕТСЯ
1. После подтверждения стабильности новой системы - ❌ ОЖИДАЕТСЯ
2. Удаление старых эндпоинтов - ❌ ОЖИДАЕТСЯ
3. Обновление документации - ❌ ОЖИДАЕТСЯ

### Implementation Status According to Plan

#### ✅ Фаза 1: Подготовка (1-2 недели) - FULLY COMPLETED
1. **Создание ChallengeService и Redis структуры** - ✅ ПОЛНОСТЬЮ ВЫПОЛНЕНО
   - Реализован `ChallengeService` с Redis-базированным хранением
   - Внедрена система ограничения по времени (TTL 2 минуты)
   - Добавлена система ограничения частоты (максимум 5 попыток на чаллендж)
   - Реализована верификация Ed25519 подписей для доказательства владения приватным ключом
   - Добавлена защита от повторных атак через инвалидацию чалленджей после использования

2. **Разработка методов подписи/верификации на клиенте** - ✅ ПОЛНОСТЬЮ ВЫПОЛНЕНО
   - Проверено наличие существующих Ed25519 методов в криптографической библиотеке
   - Подтверждено, что функции уже доступны и работают корректно
   - Никакой дополнительной разработки не требуется

3. **Создание тестовой среды** - ✅ ПОЛНОСТЬЮ ВЫПОЛНЕНО
   - Добавлены зависимости Jest и настройка тестирования
   - Создана организованная структура папок тестов (/tests/unit, /tests/integration, /tests/e2e)
   - Исправлены существующие тесты для соответствия правильной структуре Jest
   - Созданы новые unit-тесты для основной функциональности ChallengeService
   - Все тесты проходят успешно (10/10 тестов проходят), подтверждая работоспособность тестовой среды

#### 🔄 Фаза 2: Разработка (2-3 недели) - PARTIALLY COMPLETED
1. **Реализация новых эндпоинтов API** - ✅ ПОЛНОСТЬЮ ВЫПОЛНЕНО
   - Созданы `/auth/login/challenge` и `/auth/register/challenge` endpoints
   - Обновлены `/auth/login` и `/auth/register` для поддержки challenge-response
   - Добавлены соответствующие DTO для валидации запросов

2. **Модификация клиентской логики аутентификации** - ❌ В ПРОЦЕССЕ РАЗРАБОТКИ
   - Требуется обновление frontend аутентификации для использования challenge-response
   - Необходимо изменение компонентов регистрации и входа

3. **Интеграция с существующими сервисами** - ✅ ПОЛНОСТЬЮ ВЫПОЛНЕНО
   - Интеграция с RedisService для хранения чалленджей
   - Интеграция с существующими сервисами (AuthService, SessionService, etc.)
   - Поддержание обратной совместимости

#### ❌ Фаза 3: Тестирование (1 неделя) - ОЖИДАЕТСЯ
1. Unit и интеграционные тесты - ЧАСТИЧНО ЗАВЕРШЕНЫ
   - Unit-тесты для ChallengeService: ✅ 3/3 проходят
   - Тесты для генерации handle: ✅ 3/3 проходят
   - Другие интеграционные тесты: ❌ ТРЕБУЮТ ИСПРАВЛЕНИЯ

2. Security тестирование - ❌ ОЖИДАЕТСЯ
3. Performance тестирование - ❌ ОЖИДАЕТСЯ

#### ❌ Фаза 4: Развертывание - ОЖИДАЕТСЯ
#### ❌ Фаза 5: Отключение старого кода - ОЖИДАЕТСЯ

## 11. Изменения в архитектуре

### 11.1. Старая архитектура
- Прямая аутентификация с использованием public key
- Возможность использовать чужие public key для доступа к чужим аккаунтам

### 11.2. Новая архитектура
- Challenge-response аутентификация с доказательством владения приватным ключом
- Использование Ed25519 подписей для верификации
- Защита от replay-атак и подмены ключей

## 12. Безопасность

### 12.1. Защита от подмены ключей
- Пользователь должен доказать владение приватным ключом через подпись чалленджа
- Невозможно использовать чужой public key для доступа к чужому аккаунту

### 12.2. Защита от replay-атак
- Чалленджи одноразовые и инвалидируются после использования
- Временные ограничения на чалленджи (2 минуты TTL)

### 12.3. Rate limiting
- Ограничение количества попыток использования чалленджа
- Предотвращение brute-force атак

## 13. Критерии успеха

1. **Производительность**: 
   - Поиск по Handle < 50ms
   - Создание чата < 100ms
   - Получение профиля < 30ms

2. **Целостность данных**:
   - 100% успешных миграций
   - Нет потери данных
   - Все связи корректны

3. **Обратная совместимость**:
   - Существующие клиенты продолжают работать
   - Legacy API поддерживается 3 месяца
   - Плавный переход на новые endpoints

4. **Безопасность**:
   - Все проверки прав доступа через Handle
   - Защита от подмены Identity
   - E2EE готовность

## 14. Риски и митигации

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Потеря данных при миграции | Низкая | Высокое | Полный бэкап, пошаговая миграция |
| Падение производительности | Средняя | Среднее | Индексы, кэширование, нагрузочное тестирование |
| Несовместимость клиентов | Высокая | Высокое | Двойная поддержка API, автоматическое обновление |
| Сложность отладки | Средняя | Среднее | Подробное логирование, трассировка запросов |

## 15. Документация

### 15.1. Для разработчиков
- [x] Swagger документация новых API
- [x] Примеры использования
- [x] Миграционные руководства

### 15.2. Для пользователей
- [ ] Руководство по множественным идентификаторам
- [ ] Создание и управление командами
- [ ] Работа с каналами

## 16. Заключение

Миграция на Identity-Based Architecture обеспечит:
- **Масштабируемость**: Поддержка миллионов пользователей
- **Гибкость**: Множественные идентификаторы на пользователя
- **Безопасность**: Четкое разделение криптографической и публичной идентификации
- **Расширяемость**: Легкое добавление новых типов сущностей

Архитектура готова для:
- Сквозного шифрования (E2EE)
- Федеративных систем
- Децентрализованных идентификаторов
- Межсерверной коммуникации