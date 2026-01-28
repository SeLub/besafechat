# Avatar System: Identity/Handle/Profile Architecture

## 🎯 Unified Server-side подход

### Принципы
1. **Каждый Handle имеет свой аватар**
2. **Hash-based пути** для приватности: `avatars/{sha256(handleId).substring(0,16)}/avatar.png`
3. **Сервер генерирует URL** и управляет lifecycle
4. **Нет хранения URL в БД** - всегда вычисляется
5. **Унифицированная S3 логика** для будущих медиа

### Структура хранения
```
S3 Path: avatars/{hash16}/avatar.png
Database: НЕТ - URL всегда вычисляется на сервере
API: /avatars/upload, /avatars/delete
Frontend: Использует URL из API ответов
```

---

## 🔧 Реализация

### 1. Обновить S3Service (Backend) - Унифицированный
```typescript
// backend/src/domains/s3/s3.service.ts
import { createHash } from 'crypto';

export class S3Service {
  // Унифицированные методы для всех типов файлов
  async uploadObject(key: string, data: Buffer, contentType: string = 'application/octet-stream'): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await this.s3.send(command);
  }

  async deleteObjectIfExists(key: string): Promise<void> {
    try {
      await this.deleteObject(key);
    } catch (error) {
      // Игнорируем 404 - файла не было
    }
  }

  // Специфичные методы для аватаров
  private getAvatarHash(handleId: string): string {
    return createHash('sha256').update(handleId).digest('hex').substring(0, 16);
  }

  getAvatarPath(handleId: string): string {
    return `avatars/${this.getAvatarHash(handleId)}/avatar.png`;
  }

  getAvatarUrl(handleId: string): string {
    return `https://s3.tebi.io/besafe.backet/${this.getAvatarPath(handleId)}`;
  }

  async uploadAvatar(handleId: string, imageData: Buffer): Promise<string> {
    // 1. Удалить старый аватар
    await this.deleteObjectIfExists(this.getAvatarPath(handleId));
    
    // 2. Загрузить новый
    await this.uploadObject(this.getAvatarPath(handleId), imageData, 'image/png');
    
    return this.getAvatarUrl(handleId);
  }

  async deleteAvatar(handleId: string): Promise<void> {
    await this.deleteObjectIfExists(this.getAvatarPath(handleId));
  }

  // Будущие методы для медиа
  getMediaPath(handleId: string, messageId: string, filename: string): string {
    const hash = this.getAvatarHash(handleId); // Переиспользуем hash функцию
    return `media/${hash}/${messageId}/${filename}`;
  }
}
```

### 2. Создать AvatarController
```typescript
// backend/src/domains/avatar/avatar.controller.ts
import { Controller, Post, Delete, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentHandle } from '../session/decorators/current-user.decorator';
import { S3Service } from '../s3/s3.service';

@Controller('avatars')
@UseGuards(JwtSessionGuard)
export class AvatarController {
  constructor(private s3Service: S3Service) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only images allowed'), false);
      }
    }
  }))
  async uploadAvatar(
    @CurrentHandle() handle: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    // 1. Конвертация в PNG 256x256
    const processedImage = await this.processImageToPng256(file.buffer);
    
    // 2. Загрузка через S3Service
    const avatarUrl = await this.s3Service.uploadAvatar(handle.id, processedImage);
    
    return new ApiResponseDto(true, { avatarUrl });
  }

  @Delete()
  async deleteAvatar(@CurrentHandle() handle: any) {
    await this.s3Service.deleteAvatar(handle.id);
    return new ApiResponseDto(true, { message: 'Avatar deleted' });
  }

  private async processImageToPng256(buffer: Buffer): Promise<Buffer> {
    // Используем sharp или canvas для обработки
    // Конвертация в PNG 256x256
  }
}
```

### 3. Обновить ProfileService
```typescript
// backend/src/domains/profile/services/profile.service.ts
export class ProfileService {
  constructor(private s3Service: S3Service) {}

  async getProfileByHandle(handleId: string) {
    const profile = await this.profileRepository.findOne({ where: { handleId } });
    
    return {
      ...profile,
      avatarUrl: this.s3Service.getAvatarUrl(handleId) // Всегда вычисляем
    };
  }
}
```

### 4. Удалить Profile.avatarUrl
```typescript
// backend/src/domains/profile/profile.entity.ts
@Entity('profiles')
export class Profile {
  // ❌ УДАЛИТЬ
  // @Column({ type: 'text', nullable: true })
  // avatarUrl?: string;
}
```

### 5. Упростить Frontend
```typescript
// frontend/app/services/avatar.service.ts
export class AvatarService {
  static async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/avatars/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    return handleApiResponse(response);
  }

  static async deleteAvatar(): Promise<void> {
    await fetch(`${API_CONFIG.BASE_URL}/avatars`, {
      method: 'DELETE',
      credentials: 'include'
    });
  }
}
```

### 6. Обновить avatar-utils.ts
```typescript
// frontend/app/lib/avatar-utils.ts
// Просто используем URL из API, никаких вычислений
export function getAvatarUrl(profile: { avatarUrl?: string }): string | undefined {
  return profile.avatarUrl;
}
```

---

## 🔄 Обновления компонентов

### UI компоненты используют URL из API:
```typescript
// chat-list.tsx, contacts-page.tsx, middle-header.tsx
{profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} />}
```

### S3 Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow", 
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": [
      "arn:aws:s3:::besafe.backet/avatars/*/avatar.png",
      "arn:aws:s3:::besafe.backet/media/*/*"
    ]
  }]
}
```

---

## ✅ Преимущества

1. **Единая логика** - вся S3 работа на сервере
2. **Lifecycle management** - автоматическое удаление старых файлов
3. **Унификация** - готовность к медиа сообщениям
4. **Простота клиента** - обычная загрузка файлов
5. **Контроль** - валидация и обработка на сервере
6. **Масштабируемость** - легко добавить CDN, версионирование

## 🎯 Итоговый flow

1. **Upload**: `POST /avatars/upload` → S3Service → URL в ответе
2. **Display**: Используем `avatarUrl` из API ответов
3. **Delete**: `DELETE /avatars` → S3Service cleanup
4. **Storage**: Только в S3, БД не используется
5. **Fallback**: Нет avatarUrl → показать инициалы

## 📋 Чеклист изменений

- [ ] Обновить S3Service с унифицированными методами
- [ ] Создать AvatarController с upload/delete endpoints
- [ ] Обновить ProfileService для генерации avatarUrl
- [ ] Удалить `Profile.avatarUrl` из entity
- [ ] Создать AvatarService на фронтенде
- [ ] Упростить avatar-utils.ts
- [ ] Обновить все UI компоненты для использования API URLs
- [ ] Обновить S3 bucket policy
- [ ] Добавить обработку изображений (sharp/canvas)
- [ ] Тестировать upload/delete/display flow