# 🕵️‍♂️ BeSafeChat — Анонимный E2EE-Мессенджер

> **Без телефона. Без email. Без отслеживания. Только сквозное шифрование и полный контроль над данными.**

BeSafeChat — это **кроссплатформенный мессенджер с E2EE по умолчанию**, вдохновлённый Session и Signal, но с удобством Telegram.  
Регистрация анонимна, данные хранятся только на твоих устройствах, а сервер — всего лишь маршрутизатор.

---

## 🕵️‍♂️ BeSafeChat — Anonymous E2EE Messenger

**No phone. No email. No tracking. Just end-to-end encrypted communication under your control.**

BeSafeChat is a **cross-platform, privacy-first messenger** built for users who value anonymity and security. Unlike mainstream apps, BeSafeChat requires **no personal identifiers**—registration is fully anonymous using a cryptographic Ed25519 key pair generated on your device.

All messages use **end-to-end encryption** with basic implementation. The server acts only as a secure relay—**it never sees your message content**. Your chat history lives **only on your devices**, stored locally in an encrypted indexedDB database. Advanced Signal Protocol integration is in development.

Built with modern web and native technologies, BeSafeChat runs seamlessly on **Web, Desktop (Windows/macOS/Linux), and Mobile (iOS/Android)**—all from a single codebase.

### 🔐 Core Principles

- **True anonymity**: No phone number, email, or real-name required
- **E2EE in progress**: Basic encryption implemented, Signal Protocol integration in development
- **User-controlled data**: No cloud storage of message content
- **Transparency**: Open architecture, auditable code, zero telemetry

BeSafeChat isn’t just another messenger—it’s a **privacy tool for the post-surveillance era**.

---

## 🧰 Технологический стек

### Бэкенд

- **NestJS** (TypeScript, Express)
- **PostgreSQL** — метаданные пользователей и сессий
- **Redis** — отслеживание онлайна
- **Tebi** — S3-совместимое хранилище для медиа
- **WebSocket** — мгновенная доставка сообщений
- **JWT + HttpOnly Cookies** — безопасная аутентификация

### Фронтенд

- **React Router v7** — маршрутизация и SSR
- **TypeScript** — типобезопасность
- **Tailwind CSS + shadcn/ui** — современный дизайн
- **Socket.IO Client** — WebSocket соединения
- **Sonner** — уведомления
- **Dexie.js (IndexedDB)** — локальное хранение сообщений и ключей
- **AES-GCM Encryption** — сквозное шифрование локально хранимых сообщений
- **StorageService** — централизованный сервис для безопасного хранения данных

### Деплой

- **Docker Compose** — локальный запуск и развёртывание
- **Electron** — десктопный клиент (Windows/macOS/Linux)
- **Capacitor** — мобильные приложения (iOS/Android)

---

## 🚀 Быстрый старт

### 1. Клонируй репозиторий

```bash
git clone https://github.com/your-username/BeSafeChat.git
cd BeSafeChat
```

### 2. Настрой переменные окружения

Создай `/backend/.env`:

```env
PORT=4000
NODE_ENV=development

# PostgreSQL (локально — через Docker)
DB_HOST=127.0.0.1
DB_PORT=5433
DB_USERNAME=user
DB_PASSWORD=secure_password
DB_DATABASE=besafe

# Redis
REDIS_URL=redis://127.0.0.1:6380

# JWT
JWT_SECRET=your_strong_random_secret_here

# Tebi S3
STORAGE_ACCESS_KEY_ID=your_tebi_key
STORAGE_SECRET_ACCESS_KEY=your_tebi_secret
STORAGE_BUCKET_NAME=besafe.backet
STORAGE_ENDPOINT=https://s3.tebi.io

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Запусти зависимости через Docker

```bash
docker compose up -d db redis pgadmin redisinsight
```

### 4. Запусти бэкенд

```bash
cd backend
npm install
npm run start:dev
```

✅ Сервер запущен на `http://localhost:4000`  
✅ Swagger UI: `http://localhost:4000/docs`

---

## 📁 Структура проекта

```
BeSafeChat/
├── backend/                 # NestJS-бэкенд
│   ├── src/
│   │   ├── common/          # Общие утилиты
│   │   │   ├── fatal.ts                # Обработка неотловленных ошибок и graceful shutdown
│   │   │   ├── logger.ts               # Базовая конфигурация Pino-логгера
│   │   │   ├── pino-logger.service.ts  # Адаптер LoggerService для NestJS
│   │   │   ├── redis.service.ts        # Централизованное управление Redis-клиентом
│   │   │   └── validators/             # Кастомные валидаторы
│   │   │       └── is-dto-be64.validator.ts  # Валидация Ed25519-ключа в base64
│   │   ├── db/                         # Подключение к PostgreSQL
│   │   │   └── connection.ts           # Пул соединений с БД
│   │   ├── domains/                    # Доменные модули (DDD)
│   │   │   ├── chat/                   # Чаты и участники
│   │   │   │   ├── chat.entity.ts
│   │   │   │   └── chat-member.entity.ts
│   │   │   ├── contact/                # Запросы в контакты
│   │   │   │   └── contact-request.entity.ts
│   │   │   ├── media/                  # Метаданные медиафайлов
│   │   │   │   └── media.entity.ts
│   │   │   ├── message/                # Ядро мессенджера (WebSocket + E2EE)
│   │   │   │   ├── dtos/
│   │   │   └── message-payload.dto.ts
│   │   │   │   ├── gateways/
│   │   │   │   │   └── messages.gateway.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── chat-room.service.ts
│   │   │   │   │   └── message-metadata.service.ts
│   │   │   │   ├── message-metadata.entity.ts
│   │   │   │   └── message.module.ts
│   │   │   ├── s3/                     # Интеграция с Tebi (S3)
│   │   │   │   ├── s3.module.ts
│   │   │   │   ├── s3.service.ts
│   │   │   │   └── controllers/
│   │   │   │       └── s3.controller.ts
│   │   │   ├── identity/               # Криптографическая идентичность
│   │   │   │   ├── identity.entity.ts
│   │   │   │   ├── identity.module.ts
│   │   │   │   └── services/
│   │   │   │       └── identity.service.ts
│   │   │   ├── handle/                 # Идентификаторы для поиска
│   │   │   │   ├── handle.entity.ts
│   │   │   │   └── handle.module.ts
│   │   │   ├── profile/                # Профили в контекстах
│   │   │   │   ├── profile.entity.ts
│   │   │   │   └── profile.module.ts
│   │   │   ├── team/                   # Команды и организации
│   │   │   │   ├── team.entity.ts
│   │   │   │   ├── team-membership.entity.ts
│   │   │   │   └── team.module.ts
│   │   │   ├── session/                # Сессии и аутентификация
│   │   │   │   ├── session.entity.ts
│   │   │   │   ├── session.module.ts
│   │   │   │   └── services/
│   │   │   │       └── session.service.ts
│   │   ├── env.ts                      # Загрузка .env (первый импорт в main.ts)
│   │   ├── swagger.ts                  # Настройка Swagger UI
│   │   └── main.ts                     # Точка входа приложения
│   ├── .env                            # Переменные окружения (локальная разработка)
│   └── tsconfig.json
├── frontend/                           # React Router v7 приложение
│   ├── app/
│   │   ├── components/                 # UI компоненты
│   │   │   ├── ui/                     # shadcn/ui базовые компоненты
│   │   │   ├── left-column.tsx         # Левая панель с чатами
│   │   │   ├── middle-column.tsx       # Область сообщений
│   │   │   ├── message-input.tsx       # Ввод сообщений (изолированное состояние)
│   │   │   ├── message-list.tsx        # Список сообщений
│   │   │   ├── middle-header.tsx       # Заголовок чата
│   │   │   ├── hamburger-menu.tsx      # Главное меню
│   │   │   ├── contacts-page.tsx       # Управление контактами
│   │   │   ├── new-chat-modal.tsx      # Создание нового чата
│   │   │   ├── theme-selector-modal.tsx # Выбор темы оформления
│   │   │   ├── storage-settings-modal.tsx # Настройки хранения сообщений
│   │   │   └── auth-guard.tsx          # Защита маршрутов
│   │   ├── css/                        # Стили и темы
│   │   │   └── themes/                 # Цветовые схемы
│   │   │       ├── besafe.theme.css   # Зелёная privacy-focused тема
│   │   │       ├── telegram.theme.css  # Синяя классическая тема
│   │   │       └── minimal.theme.css   # Монохромная минималистичная тема
│   │   ├── hooks/                      # React хуки
│   │   │   ├── use-auth.tsx            # Аутентификация
│   │   │   ├── use-chats.tsx           # Управление чатами
│   │   │   ├── use-theme.tsx           # Управление темами оформления
│   │   │   ├── use-notifications.tsx   # Уведомления
│   │   │   └── use-websocket-notifications.tsx # WebSocket уведомления
│   │   ├── lib/                        # Библиотеки и утилиты
│   │   │   └── db/                     # IndexedDB (Dexie.js)
│   │   │       ├── db.ts               # Инициализация базы данных (версия 3)
│   │   │       ├── schema.ts           # Схема таблиц (messages, contacts, publicKey)
│   │   │       ├── encryption.ts       # AES-GCM шифрование для приватных ключей
│   │   │       ├── key-management.ts   # Управление криптографическими ключами
│   │   │       ├── message-storage.ts  # Сохранение и загрузка сообщений
│   │   │       ├── contact-storage.ts  # Управление контактами
│   │   │       └── cleanup.ts          # Автоочистка старых сообщений
│   │   ├── routes/                     # Маршруты приложения
│   │   │   ├── index.tsx               # Главная страница чата
│   │   │   └── auth.tsx                # Страница аутентификации
│   │   └── root.tsx                    # Корневой компонент
│   └── vite.config.ts                  # Конфигурация Vite
├── docker-compose.yml                  # Оркестрация: PostgreSQL, Redis, pgAdmin, RedisInsight
├── .gitignore
└── README.md
```

## 📁 Архитектура проекта: `src/`

### `src/common/` — Общие утилиты, не привязанные к доменам

- **`fatal.ts`** — обработка неотловленных исключений и graceful shutdown
- **`logger.ts`** — конфигурация Pino-логгера
- **`pino-logger.service.ts`** — адаптер `LoggerService` для интеграции с NestJS
- **`redis.service.ts`** — централизованное подключение и управление Redis-клиентом
- **`validators/`** — кастомные валидаторы для DTO
  - **`is-dto-be64.validator.ts`** — проверка корректности Ed25519-ключа в формате base64

---

### `src/domains/` — Доменные модули (DDD-подход)

Каждый модуль — самодостаточен и содержит всё, что нужно для своей области ответственности.

#### `identity/` — Криптографическая идентичность

- **`identity.entity.ts`** — основная сущность идентичности (публичный ключ = ID)
- **`identity.module.ts`** — модуль для инъекции сервиса
- **`services/identity.service.ts`** — логика регистрации и поиска идентичности

#### `handle/` — Идентификаторы для поиска

- **`handle.entity.ts`** — сущность идентификатора (username, email, phone, и т.д.)
- **`handle.module.ts`** — модуль для инъекции сущности

#### `profile/` — Профили в контекстах

- **`profile.entity.ts`** — сущность профиля (разные профили для разных контекстов)
- **`profile.module.ts`** — модуль для инъекции сущности

#### `team/` — Команды и организации

- **`team.entity.ts`** — сущность команды/организации
- **`team-membership.entity.ts`** — связь «идентичность ↔ команда»
- **`team.module.ts`** — модуль для инъекции сущностей

#### `session/` — Сессии и аутентификация

- **`session.entity.ts`** — активные устройства (мультидевайс)
- **`session.module.ts`** — модуль для инъекции сущности
- **`services/session.service.ts`** — логика управления сессиями (создание, отзыв)

#### `chat/` — Чаты и участники

- **`chat.entity.ts`** — сущность чата (приватные, групповые, командные)
- **`chat-member.entity.ts`** — связь «идентичность ↔ чат» (многие-ко-многим)

#### `message/` — Ядро мессенджера (WebSocket + E2EE)

- **`gateways/`**
 - `messages.gateway.ts` — Socket.IO-шлюз для доставки сообщений
- **`dtos/`**
 - `message-payload.dto.ts` — структура E2EE-сообщения (зашифрованное содержимое + ключ)
- **`services/`**
 - `message-metadata.service.ts` — сохранение метаданных
  - `chat-room.service.ts` — создание чатов 1:1, управление комнатами
- **Сущность**
  - `message-metadata.entity.ts` — метаданные сообщений (без раскрытия содержимого)

#### `contact/` — Запросы в контакты

- **`contact-request.entity.ts`** — сущность запроса в контакты

#### `s3/` — Работа с медиа (Tebi S3)

- **`s3.service.ts`** — генерация pre-signed URL для загрузки/скачивания
- **`s3.module.ts`** — модуль для инъекции сервиса
- **`controllers/s3.controller.ts`** — контроллер для загрузки/скачивания файлов

#### `media/` — Метаданные медиафайлов

- **`media.entity.ts`** — информация о загруженных файлах (опционально)

---

## 💡 Ключевые принципы архитектуры

- **Чёткое разделение ответственности** — каждый домен независим
- **Безопасность по умолчанию** — E2EE, HttpOnly куки, валидация DTO
- **Масштабируемость** — готовность к групповым чатам, медиа, мультиплатформе
- **Типобезопасность** — полная типизация через TypeScript и NestJS
- **Identity-Based Architecture** — разделение криптографической идентичности от социальных профилей
- **Контекстуальные профили** — разные профили для разных контекстов (работа, личное, и т.д.)

---

---

## 📚 API Документация

Вся документация доступна через **Swagger UI**:

🔗 **http://localhost:4000/docs**

### Основные эндпоинты

| Метод  | Путь                        | Описание                                 |
| ------ | --------------------------- | ---------------------------------------- |
| `POST` | `/auth/login`               | Анонимный вход по публичному ключу       |
| `GET`  | `/auth/profile`             | Получить профиль (только авторизованные) |
| `GET`  | `/auth/sessions`            | Список активных сессий                   |
| `POST` | `/auth/sessions/revoke/:id` | Отозвать сессию                          |
| `POST` | `/auth/logout`              | Выйти из текущей сессии                  |
| `POST` | `/auth/refresh`             | Обновить токены                          |

> 💡 Все защищённые эндпоинты требуют **валидного `access_token` в HttpOnly-куках**.

Защищены следующие маршруты. Все они требуют валидного `access_token` в HttpOnly-куках:

| Метод  | Путь                        | Описание                                |
| ------ | --------------------------- | --------------------------------------- |
| `GET`  | `/auth/profile`             | Получение профиля текущего пользователя |
| `GET`  | `/auth/sessions`            | Список активных сессий                  |
| `POST` | `/auth/sessions/revoke/:id` | Отзыв конкретной сессии (не текущей)    |
| `POST` | `/auth/logout`              | Завершение текущей сессии               |

---

# 🧪 Тестирование API через Swagger UI

Swagger UI позволяет **тестировать все эндпоинты прямо из браузера** — без написания кода.

### Генерация тестового публичного ключа

Для тестирования `POST /auth/login` нужен **валидный Ed25519 публичный ключ** (44 символа в base64).

**В терминале:**

```bash
node -e "console.log(Buffer.from(crypto.randomBytes(32)).toString('base64'))"
```

**В браузере:**

```js
const key = await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
  "verify",
]);
const pub = await crypto.subtle.exportKey("raw", key.publicKey);
console.log(btoa(String.fromCharCode(...new Uint8Array(pub))));
```

Пример валидного ключа:

```
wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=
```

### Шаг 1: Открой Swagger UI

Перейди по адресу:  
🔗 **http://localhost:4000/docs**

### Шаг 2: Выполни вход и получи `access_token`

1. Разверни эндпоинт **`POST /auth/login`**
2. Нажми **«Try it out»**
3. В поле **`publicKey`** введи валидный base64 Ed25519 ключ (44 символа):
   ```text
   wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=
   ```
4. В поле **`deviceId`** введи:
   ```text
   swagger-test
   ```
5. Нажми **«Execute»**

✅ В ответе появится `200 OK`  
✅ Браузер **автоматически сохранит куки** `access_token` и `refresh_token`

> 💡 Swagger UI **не показывает HttpOnly-куки**, но они установлены и работают.

### Шаг 3: Авторизуйся в Swagger

1. Нажми кнопку **«Authorize»** (вверху справа)
2. В поле **`access_token`** введи **любое значение** (например, `dummy`)  
   → Это нужно только для активации замка на эндпоинтах
3. Нажми **«Authorize»**

> ⚠️ **Важно**: На самом деле авторизация работает **через куки**, а не через это поле.  
> Но Swagger требует заполнения, чтобы разрешить тестирование защищённых эндпоинтов.

### Шаг 4: Тестируй защищённые эндпоинты

Теперь все эндпоинты с замком (🔒) можно тестировать:

- **`GET /auth/profile`** → вернёт твой профиль
- **`GET /auth/sessions`** → список устройств
- **`POST /auth/logout`** → завершит сессию

Нажми **«Try it out» → «Execute»** — запросы будут выполняться с твоими куками автоматически.

### Шаг 5: Обнови токены (если нужно)

Если сессия истекла:

1. Перейди в **`POST /auth/refresh`**
2. Нажми **«Try it out»**
3. Swagger автоматически использует куку `refresh_token`
4. После **«Execute»** получишь новые куки

---

> 💡 **Совет**: Для долгой работы в Swagger держи вкладку открытой — куки сохраняются между запросами.

---

---

## 🧪 Тестирование API (через curl)

### 1. Вход

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=","deviceId":"test"}' \
  -c cookies.txt
```

### 2. Получить профиль

```bash
curl -X GET http://=localhost:4000/auth/profile -b cookies.txt
```

### 3. Установить публичное имя (`@username`)

```bash
curl -X POST http://localhost:4000/username/set \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"username":"alice_dev","isSearchable":"yes"}'
```

> 💡 `isSearchable` может быть `"yes"` (можно найти по имени) или `"no"` (скрытый профиль).

### 4. Найти пользователя по имени

```bash
curl -X GET http://localhost:4000/username/search/alice_dev
# → Возвращает публичный ключ, если имя разрешено к поиску
```

### 5. Обновить токены

```bash
REFRESH=$(grep refresh_token cookies.txt | awk '{print $7}')
curl -X POST http://localhost:4000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  -c new_cookies.txt
```

### 6. Посмотреть активные сессии

```bash
curl -X GET http://localhost:4000/auth/sessions -b cookies.txt
```

### 7. Выйти

```bash
curl -X POST http://localhost:4000/auth/logout -b cookies.txt
```

---

## 🔧Тестирование WebSocket в Postman

1. Берешь публичные ключи public_key из базы данных с помощю запросов по ID пользователя:

```bash

curl http://localhost:4000/auth/user/7abb74ba-22bf-41c5-a2ed-618528a5e2ab/public-key
wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=
```

```bash

curl http://localhost:4000/auth/user/6d36bdb6-8651-4d72-94f4-3c9aa13f489d/public-key
fxhKP0trJd8XJR3IPTVOmA+BFXpFgWtJDRLC8LOZnMI=
```

2. Логинишься чтобы получить access_token используй запросы:

```bash
curl -X POST http://localhost:4000/auth/login \
-H "Content-Type: application/json" \
-d '{"publicKey":"wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=","deviceId":"test"}' \
-c cookies1.txt

```

```bash
curl -X POST http://localhost:4000/auth/login \
-H "Content-Type: application/json" \
-d '{"publicKey":"fxhKP0trJd8XJR3IPTVOmA+BFXpFgWtJDRLC8LOZnMI=","deviceId":"test"}' \
-c cookies2.txt
```

Далее как указано в разделе тестирования WebSocket в Postman

### Шаг 1: Получи `access_token` из `cookies.txt`

Выполни в терминале:

```bash
grep access_token cookies.txt | awk '{print $7}'
```

→ Скопируй значение (например: `abc123def456...`)

---

### Шаг 2: Настрой WebSocket-запрос в Postman

1. **URL подключения**:

   ```
   ws://localhost:4000/messages
   ```

2. **Во вкладке `Headers` добавь заголовок**:  
   | Key | Value |
   |-----|-------|
   | `Cookie` | `access_token=abc123def456...` |

   > 💡 Именно **`Cookie`** (с заглавной C), а не `cookie`  
   > Это стандартный HTTP-заголовок для передачи кук

3. **Во вкладке `Settings`**:
   - ✅ Включи **`Enable auto-reconnect`**
   - ✅ Включи **`Use WebSocket subprotocols`** (если есть)

---

### Шаг 3: Подключи и отправь сообщение

1. Нажми **`Connect`**  
   → В логах должно появиться: `🟢 User ... connected`

2. **Во вкладке `Message`**:

   - **Event**: `message`
   - **Payload** (JSON):
     ```json
     {
       "to": "7abb74ba-22bf-41c5-a2ed-618528a5e2ab",
       "type": "text",
       "encryptedContent": "U2FsdGVkX1+abc123==",
       "encryptedKey": "U2FsdGVkX1+def456==",
       "timestamp": "2025-11-27T10:00:00.000Z"
     }
     ```

3. Нажми **`Send`**

---

## ⚠️ Важные нюансы

| Проблема                      | Решение                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Postman не подключается**   | Убедись, что в `Headers` именно `Cookie`, а не `Set-Cookie`                    |
| **401 Unauthorized**          | Проверь, что токен **не expired** (срок 30 минут)                              |
| **Сообщение не доставляется** | Убедись, что получатель **онлайн** (подключён через Postman или другой клиент) |

---

## ✅ Текущий статус реализации

### Реализовано

- ✅ **Аутентификация**: Ed25519 ключи, JWT куки, мульти-сессии
- ✅ **Система контактов**: Запросы, принятие/отклонение, поиск по @username
- ✅ **Real-time сообщения**: WebSocket, мгновенная доставка
- ✅ **UI/UX**: Telegram-подобный интерфейс, 3 темы оформления (BeSafe/Telegram/Minimal)
- ✅ **Система тем**: Переключаемые цветовые схемы с сохранением в localStorage
- ✅ **Уведомления**: Toast сообщения, счетчики непрочитанных
- ✅ **Архитектура**: Модульная структура, изолированные состояния
- ✅ **Online статус**: Redis-based отслеживание с real-time обновлениями через WebSocket
- ✅ **Локальное хранение**: IndexedDB (BeSafeDB) для сообщений, контактов и ключей
- ✅ **Управление хранилищем**: Настройки автоочистки (7/30/90 дней / Всегда), лимит 1000 сообщений на чат
- ✅ **Шифрование сообщений**: AES-GCM шифрование для защиты локально хранимых сообщений
- ✅ **Шифрование ключей**: AES-GCM для защиты приватных ключей в IndexedDB
- ✅ **Централизованный StorageService**: Объединённый сервис для безопасного хранения данных
- ✅ **Unicode поддержка**: Корректная работа с кириллицей, эмодзи и любыми символами
- ✅ **Дедупликация сообщений**: ID-based защита от дублирования при множественных WebSocket соединениях
- ✅ **Персистентность чатов**: Восстановление выбранного чата и истории сообщений после перезагрузки страницы
- ✅ **Seed-based Recovery**: BIP39 12-word seed phrases с двумя режимами восстановления
  - **Cloud Recovery**: Argon2id-encrypted seed в S3, восстановление по @username + password
  - **Self-Custody**: Локальное хранение seed, полный контроль пользователя
- ✅ **Безопасность хранения**: Временное хранение seed только в памяти (не в IndexedDB)
- ✅ **Криптография**: @scure/bip39, @noble/ed25519, @noble/hashes (browser-native, без полифилов)
- ✅ **Username-based Recovery**: Публичный эндпоинт для восстановления аккаунта без предварительной аутентификации
- ✅ **Profile Management**: Загрузка аватаров, редактирование display name
- ✅ **Unified Storage API**: Единый `/storage` endpoint для всех типов файлов (аватары, изображения, документы)
- ✅ **Зашифрованное хранение**: Все сообщения шифруются перед сохранением в IndexedDB
- ✅ **Public Avatars**: Прямые S3 URL для аватаров без presigned URLs, автоматическое отображение в чатах и контактах
- ✅ **Device Management**: Просмотр активных сессий, отзыв устройств, QR-код для подключения (mock)
- ✅ **Identity-Based Architecture**: Новая архитектура с отдельными сущностями Identity, Handle, Profile, Team
- ✅ **Контекстуальные профили**: Разные профили для разных контекстов (работа, личное, команды)
- ✅ **Командная структура**: Поддержка организаций и команд с иерархией
- ✅ **Гибкие идентификаторы**: Поддержка разных типов идентификаторов (username, email, phone)

### В разработке

- 🔄 **Advanced E2EE**: Signal Protocol интеграция для сообщений
- 🔄 **Медиа сообщения**: Загрузка изображений/видео/документов в чаты

---

## 🗺 План будущей разработки

### Этап 1: Базовый мессенджер (Q1 2026)

- [x] Анонимная регистрация и аутентификация
- [x] Управление сессиями и безопасность
- [x] WebSocket-шлюз для E2EE-сообщений
- [x] **Базовый фронтенд (React Router v7)**
- [x] **Система контактов и запросов**
- [x] **Real-time сообщения**
- [x] **Telegram-подобный UI**
- [x] **Компонентная архитектура**
- [x] **Online статус пользователей**
- [x] **Система тем**: 3 цветовые схемы с переключением в настройках
- [x] **Локальное хранение сообщений**: IndexedDB (BeSafeDB) с автоочисткой и лимитами
- [x] **Шифрование приватных ключей**: AES-GCM в IndexedDB
- [x] **Дедупликация сообщений**: Защита от дублей через уникальные ID
- [x] **Персистентность состояния**: Восстановление чатов после перезагрузки
- [x] **Seed-based Account Recovery**: BIP39 12-word seed с Cloud/Self-Custody режимами
- [x] **Username System**: Обязательная регистрация @username для восстановления аккаунта
- [x] **Profile System**: Аватары (PNG, до 5MB), display name (1-24 символа, emoji)
- [x] **Storage API**: Унифицированные endpoints для загрузки файлов в S3
- [x] **Device Management**: Управление активными сессиями, multi-device support
- [x] **Seed-based Recovery**: BIP39 seed phrases with cloud and self-custody options
- [x] **Enhanced Security**: Temporary seed storage (no persistent IndexedDB storage)
- [x] Базовое E2EE шифрование локально хранимых сообщений (AES-GCM)
- [x] Advanced E2EE шифрование сообщений (Signal Protocol)
- [x] Медиа-сообщения (фото/файлы через S3)
- [x] Identity-Based Architecture с контекстуальными профилями
- [x] Командная структура иерархия
- [ ] Улучшенная система поиска и открытия чатов

### Этап 2: Кроссплатформенность (Q2 2026)

- [ ] Electron-обёртка для десктопа
- [ ] Capacitor для iOS/Android
- [ ] Локальное хранение истории (indexedDB)

### Этап 3: Дополнительные функции (Q3 2026)

- [ ] Медиа-сообщения (фото/файлы через Tebi)
- [ ] Опциональные `@username` с Proof-of-Work
- [ ] Резервная фраза (24 слова) для восстановления

---

## 🛡 Безопасность

- **Нет привязки к телефону/email** — полная анонимность
- **E2EE в разработке** — базовое шифрование реализовано, Signal Protocol в процессе
- **Локальное E2EE** — все сообщения шифруются в IndexedDB с помощью AES-GCM
- **HttpOnly JWT-куки** — защита от XSS
- **Ограничение сессий** — макс. 5 устройств
- **Безопасность seed-фраз** — временно в памяти, не в IndexedDB
- **Аудит зависимостей** — через `npm audit`
- **Identity-Based Architecture** — разделение криптографической идентичности от социальных профилей
- **Контекстуальная приватность** — разные видимости для разных контекстов

---

## 📄 Лицензия

MIT © 2025 BeSafeChat Team

---

## 🙌 Поддержка

Нашли баг? Хотите предложить фичу?  
→ Откройте [Issue](https://github.com/your-username/BeSafeChat/issues)  
→ Или пришлите [Pull Request](https://github.com/your-username/BeSafeChat/pulls)

---

## 📈 Proposed Improvements for BeSafeChat

### 🔒 Security Enhancements

1. **Strengthen Seed Backup Security**
   - Increase Argon2id parameters (timeCost: 5, memoryCost: 128MB)
   - Add pepper for additional security layer
   - Implement device fingerprinting for session validation

2. **Advanced Message Integrity**
   - Implement Signal Protocol for true E2EE
   - Add message signature verification
   - Implement Perfect Forward Secrecy (PFS)

3. **Enhanced Session Management**
   - Multi-device synchronization with secure key sharing
   - Automatic key rotation when devices are removed
   - Suspicious activity detection and notifications

### 🚀 Functional Improvements

4. **Group Chat Support**
   - Secure group key management
   - End-to-end encrypted group messaging
   - Group admin features and permissions

5. **Advanced Message Features**
   - Message reactions and editing
   - Message threading and replies
   - Scheduled messages

6. **Media Support**
   - End-to-end encrypted image/video sharing
   - File sharing with chunked upload
   - Voice message support

### 🎨 User Experience Enhancements

7. **Advanced Theme System**
   - Custom theme creation
   - Accessibility features (high contrast, font size)
   - Dynamic theme switching

8. **Enhanced Notifications**
   - Rich notification system with privacy controls
   - Do-not-disturb scheduling
   - Notification filtering and grouping

9. **Advanced Privacy Controls**
   - Message expiration (disappearing messages)
   - Read receipts toggle
   - Typing indicators toggle

## 🗺 Implementation Roadmap

### Phase 1 (Next 2-4 weeks): Security Hardening
- [ ] Implement enhanced Argon2id parameters
- [ ] Add message integrity verification
- [ ] Strengthen session management
- [ ] Implement rate limiting and DDoS protection

### Phase 2 (Next 4-8 weeks): Feature Expansion
- [ ] Complete Signal Protocol integration
- [ ] Add group chat functionality
- [ ] Implement multi-device sync
- [ ] Add advanced notification system

### Phase 3 (Next 8-12 weeks): Advanced Features
- [ ] Media messaging (images, voice, files)
- [ ] Message reactions and editing
- [ ] Enhanced privacy controls
- [ ] Advanced theme customization

### Phase 4 (Long-term): Platform Expansion
- [ ] Electron desktop application
- [ ] Mobile app with Capacitor
- [ ] Advanced contact management
- [ ] Voice/video calling capabilities

## 📊 Expected Benefits

- **Enhanced Security**: Stronger encryption, better session management, improved integrity verification
- **Better User Experience**: Rich themes, advanced notifications, multi-device sync
- **Scalability**: Group chats, enhanced message storage, better performance
- **Privacy**: Zero-knowledge architecture maintained, enhanced privacy controls
- **Reliability**: Better error handling, monitoring, and recovery options

---

Готов к работе! 🚀
**BeSafeChat — твой разговор остаётся между вами.**
