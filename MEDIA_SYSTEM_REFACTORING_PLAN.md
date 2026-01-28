# Media System Refactoring Plan

## 🎯 Цель
Унифицировать загрузку всех типов файлов через единый серверный API, убрать дублирование функциональности между фронтендом и бэкендом.

## 📁 Структура S3 хранилища

```
s3://besafe.bucket/
├── seeds/
│   └── {hash(password)}/
│       └── seed.enc                    ← Зашифрованный seed для восстановления
├── handles/
│   └── {hash16(handleId)}/
│       ├── avatar.png                  ← Аватар пользователя (256x256)
│       ├── media/
│       │   ├── images/
│       │   │   ├── {messageId}_photo1.jpg
│       │   │   └── {messageId}_photo2.png
│       │   ├── videos/
│       │   │   ├── {messageId}_video1.mp4
│       │   │   └── {messageId}_video2.webm
│       │   ├── documents/
│       │   │   ├── {messageId}_document.pdf
│       │   │   └── {messageId}_report.docx
│       │   └── audio/
│       │       └── {messageId}_voice.mp3
│       └── backups/
│           ├── messages_{timestamp}.db.enc
│           └── contacts_{timestamp}.json.enc
└── shared/
    ├── public/
    │   └── default-avatars/
    └── temp/
        └── {sessionId}/                ← Временные файлы (TTL 24h)
```

## 🔧 Архитектура

### Backend: Единый MediaController

```typescript
@Controller('media')
export class MediaController {
  
  // Загрузка файлов
  @Post('upload/:type')
  uploadFile(@Param('type') type: MediaType, @UploadedFile() file, @CurrentHandle() handle)
  
  // Получение файлов
  @Get(':type/:path(*)')
  getFile(@Param('type') type: MediaType, @Param('path') path: string)
  
  // Удаление файлов
  @Delete(':type/:path(*)')
  deleteFile(@Param('type') type: MediaType, @Param('path') path: string)
}

enum MediaType {
  AVATAR = 'avatar',
  IMAGE = 'image', 
  DOCUMENT = 'document',
  AUDIO = 'audio',
  SEED = 'seed',
  BACKUP = 'backup'
}
```

### Frontend: Упрощенный MediaService

```typescript
export class MediaService {
  static uploadAvatar(file: File): Promise<{url: string}>
  static uploadImage(file: File, messageId?: string): Promise<{url: string}>
  static uploadDocument(file: File, messageId?: string): Promise<{url: string}>
  static uploadSeed(encryptedData: Blob, passwordHash: string): Promise<{success: boolean}>
  
  static deleteAvatar(): Promise<void>
  static deleteFile(type: MediaType, path: string): Promise<void>
}
```

## 📋 План реализации

### Этап 1: Backend рефакторинг

#### 1.1 Создать MediaService
- [ ] `backend/src/domains/media/media.service.ts`
- [ ] Унифицированные методы для всех типов файлов
- [ ] Логика путей согласно новой структуре S3
- [ ] Обработка файлов (resize для аватаров, валидация)

#### 1.2 Создать MediaController  
- [ ] `backend/src/domains/media/media.controller.ts`
- [ ] `POST /media/upload/:type` - загрузка через сервер
- [ ] `GET /media/:type/:path(*)` - получение файлов
- [ ] `DELETE /media/:type/:path(*)` - удаление файлов
- [ ] Swagger документация

#### 1.3 Заменить существующие контроллеры
- [ ] Удалить `AvatarController` 
- [ ] Удалить `S3Controller`
- [ ] Заменить на единый `MediaController`
- [ ] Добавить `MediaModule` в `app.module.ts`

#### 1.4 Обновить S3Service
- [ ] Полностью переписать под новую структуру путей
- [ ] Убрать все старые методы
- [ ] Добавить методы для всех типов медиа

### Этап 2: Frontend рефакторинг

#### 2.1 Создать MediaService
- [ ] `frontend/app/services/media.service.ts`
- [ ] Методы для всех типов файлов
- [ ] Единый интерфейс загрузки

#### 2.2 Заменить существующие сервисы
- [ ] Удалить `AvatarService`
- [ ] Удалить `S3Service` полностью
- [ ] Заменить все импорты на `MediaService`

#### 2.3 Обновить компоненты
- [ ] Обновить все компоненты, использующие `S3Service`
- [ ] Использовать новый `MediaService`

### Этап 3: Тестирование

#### 3.1 Обновить тестовые страницы
- [ ] `frontend/app/routes/mediatest.tsx` (новая, заменит s3test.tsx)
- [ ] `frontend/app/routes/avatartest.tsx` (обновить под новый API)
- [ ] Тесты для всех типов медиа

#### 3.2 Создать тесты
- [ ] Unit тесты для `MediaService`
- [ ] Integration тесты для `MediaController`
- [ ] E2E тесты загрузки файлов

### Этап 4: Очистка

#### 4.1 Удалить устаревший код (сразу)
- [ ] Удалить `backend/src/domains/avatar/` полностью
- [ ] Удалить `backend/src/domains/s3/controllers/s3.controller.ts`
- [ ] Удалить `frontend/app/services/s3-service.ts`
- [ ] Удалить `frontend/app/services/avatar.service.ts`
- [ ] Удалить `frontend/app/routes/s3test.tsx`

#### 4.2 Обновить документацию
- [ ] Обновить README.md
- [ ] Обновить API документацию
- [ ] Создать migration guide

## 🔄 Маршруты API

### Текущие (будут удалены)
```
POST /s3/upload          → Удалить
POST /s3/download        → Удалить  
DELETE /s3/delete        → Удалить
POST /avatars/upload     → Заменить
DELETE /avatars          → Заменить
```

### Новые (унифицированные)
```
POST /media/upload/avatar              → Загрузка аватара
POST /media/upload/image               → Загрузка изображения
POST /media/upload/document            → Загрузка документа
POST /media/upload/audio               → Загрузка аудио
POST /media/upload/seed                → Загрузка seed (cloud backup)
POST /media/upload/backup              → Загрузка бэкапа

GET /media/avatar/{handleHash}         → Получение аватара
GET /media/image/{handleHash}/{path}   → Получение изображения
GET /media/document/{handleHash}/{path}→ Получение документа
GET /media/seed/{passwordHash}         → Получение seed

DELETE /media/avatar                   → Удаление аватара
DELETE /media/{type}/{path}            → Удаление файла
```

## 📊 Преимущества после рефакторинга

### Безопасность
- ✅ Нет прямого доступа к S3 с фронтенда
- ✅ Серверная валидация всех файлов
- ✅ Контроль доступа на уровне API

### Производительность  
- ✅ Серверная обработка файлов (resize, compression)
- ✅ Единый кэш для всех медиа
- ✅ Оптимизированные пути S3

### Разработка
- ✅ Единый API для всех типов файлов
- ✅ Простота фронтенда (только FormData)
- ✅ Легкость добавления новых типов медиа

### Масштабируемость
- ✅ Готовность к CDN
- ✅ Версионирование файлов
- ✅ Batch операции

## 🧪 Тестирование

### Тестовые сценарии
1. **Аватары**: Загрузка PNG/JPG → автоматический resize → публичный URL
2. **Изображения**: Загрузка в чат → сжатие → приватный доступ
3. **Документы**: Загрузка PDF/DOC → валидация → безопасное хранение
4. **Seeds**: Зашифрованная загрузка → восстановление по паролю
5. **Бэкапы**: Периодическое сохранение → шифрование → восстановление

### Страницы тестирования
- `/mediatest` - тестирование всех типов медиа
- `/avatartest` - специфичное тестирование аватаров
- `/seedtest` - тестирование cloud backup seeds

## 📅 Временные рамки

- **Этап 1**: Backend рефакторинг - 2-3 дня
- **Этап 2**: Frontend рефакторинг - 1-2 дня  
- **Этап 3**: Тестирование - 1 день
- **Этап 4**: Очистка и документация - 1 день

**Общее время**: 2-3 дня (без миграции)

## 🚨 Упрощения для нового продукта

### Нет пользователей = нет миграции
- ✅ Можем делать breaking changes
- ✅ Полная замена старых эндпоинтов
- ✅ Новая структура S3 с нуля
- ✅ Удаление старого кода без fallback

### Упрощенный план
- Сразу удаляем `/s3/*` и `/avatars/*` эндпоинты
- Заменяем на `/media/*` без обратной совместимости
- Полностью переписываем S3Service под новую структуру
- Удаляем frontend S3Service сразу