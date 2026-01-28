# Avatar System: Identity/Handle/Profile Architecture

## 🎯 Новая архитектура: Hash-based Avatars

### Принципы
1. **Каждый Handle имеет свой аватар**
2. **Hash-based пути** для приватности: `avatars/{sha256(handleId).substring(0,16)}.png`
3. **Клиент вычисляет путь** без запросов к серверу
4. **Нет хранения URL в БД** - всегда вычисляется

### Структура хранения
```
S3 Path: avatars/{hash16}/avatar.png
Database: НЕТ - URL всегда вычисляется
Frontend: getAvatarUrl(handleId) → hash → S3 URL
```

---

## 🔧 Реализация

### Backend: S3Service
```typescript
// backend/src/domains/s3/s3.service.ts
import { createHash } from 'crypto';

private getAvatarPath(handleId: string): string {
  const hash = createHash('sha256').update(handleId).digest('hex');
  return `avatars/${hash.substring(0, 16)}/avatar.png`;
}

validateAndConstructPath(path: string, filename: string, handleId: string): string {
  if (filename === 'avatar.png') {
    return this.getAvatarPath(handleId);
  }
  // ... остальная логика
}
```

### Frontend: avatar-utils.ts
```typescript
// frontend/app/lib/avatar-utils.ts
import { sha256 } from '@noble/hashes/sha256';

function getAvatarHash(handleId: string): string {
  const hash = sha256(new TextEncoder().encode(handleId));
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 16);
}

export function getAvatarUrl(handleId: string): string {
  const hash = getAvatarHash(handleId);
  return `https://s3.tebi.io/besafe.backet/avatars/${hash}/avatar.png`;
}
```

### Profile Entity (БЕЗ avatarUrl)
```typescript
// backend/src/domains/profile/profile.entity.ts
@Entity('profiles')
export class Profile {
  // ... другие поля
  
  // ❌ УДАЛИТЬ
  // @Column({ type: 'text', nullable: true })
  // avatarUrl?: string;
}
```

---

## 🔄 Обновления компонентов

### Замены в UI
```typescript
// ВСЕ компоненты: заменить userId на handleId

// chat-list.tsx
{chat.handleId && <AvatarImage src={getAvatarUrl(chat.handleId)} />}

// contacts-page.tsx  
{contact.handleId && <AvatarImage src={getAvatarUrl(contact.handleId)} />}

// middle-header.tsx
{selectedChat.handleId && <AvatarImage src={getAvatarUrl(selectedChat.handleId)} />}
```

### S3 Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow", 
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::besafe.backet/avatars/*/avatar.png"
  }]
}
```

---

## ✅ Преимущества

1. **Приватность**: handleId не раскрывается в URL
2. **Простота**: Нет хранения URL в БД
3. **Производительность**: Нет лишних запросов к БД
4. **Детерминированность**: URL всегда одинаковый для handleId
5. **Кэширование**: Браузер кэширует по стабильному URL

## 🎯 Итоговый flow

1. **Upload**: `S3Service.uploadAvatar(handleId, file)` → `avatars/{hash16}/avatar.png`
2. **Display**: `getAvatarUrl(handleId)` → hash → S3 URL
3. **Storage**: Только в S3, БД не используется
4. **Fallback**: 404 → показать инициалы