# 📋 План реализации мультимедиа-хранилища для BeSafeChat

**Версия**: 2.0  
**Дата обновления**: Февраль 2026  
**Статус**: ✅ Актуально (соответствует реализованной CryptoKey-архитектуре)  
**Язык**: Русский

---

## 🎯 Краткое резюме

BeSafeChat переходит от поддержки только текстовых сообщений к полноценной мультимедиа-платформе с сохранением принципов сквозного шифрования (E2EE).

**Рекомендуемая архитектура**: **Гибридная модель (Option 4)**

- ✅ Небольшие файлы и превью хранятся локально в IndexedDB
- ✅ Крупные файлы загружаются в S3 (Tebi) в зашифрованном виде
- ✅ Все криптографические операции выполняются на клиенте
- ✅ Ключи шифрования — неэкспортируемые `CryptoKey`, хранятся в IndexedDB

**Оценка усилий**: 2-3 недели (2 разработчика)  
**Приоритет**: Высокий (необходимо для конкурентоспособности продукта)

---

## 📊 Сравнение архитектурных опций

| Критерий                       | Local Only | IndexedDB Only | S3 Only | **Hybrid ⭐** | Multi-S3 |
| ------------------------------ | ---------- | -------------- | ------- | ------------- | -------- |
| **Конфиденциальность**         | 🟢🟢🟢     | 🟢🟢           | ⚠️      | 🟢🟢🟢        | 🟢🟢     |
| **Кросс-девайс синхронизация** | ❌         | ❌             | 🟢🟢🟢  | 🟢🟢🟢        | 🟢🟢🟢   |
| **Неограниченное хранилище**   | ❌         | ❌             | 🟢🟢🟢  | 🟢🟢🟢        | 🟢🟢🟢   |
| **Работа оффлайн**             | 🟢🟢🟢     | 🟢🟢🟢         | ❌      | 🟢🟢          | ❌       |
| **Простота реализации**        | 🟢🟢🟢     | 🟢🟢           | 🟢🟢    | ⚠️            | ❌       |
| **Стоимость инфраструктуры**   | $0         | $0             | $$      | $             | $$$      |
| **Защита от XSS**              | 🟢         | 🟢             | ⚠️      | 🟢🟢          | 🟢🟢     |
| **Соответствие E2EE**          | ✅         | ✅             | ⚠️      | ✅✅          | ✅       |

### 🟢 РЕКОМЕНДАЦИЯ: Hybrid Model (Option 4)

**Почему именно эта модель**:

- Баланс приватности и функциональности
- Индустриальный стандарт (Signal, Wire, Telegram)
- Работает оффлайн для последних сообщений
- Масштабируется до неограниченного объёма через S3
- Управляемая сложность реализации

---

## 🔐 Криптографическая архитектура (актуализировано)

### Алгоритмы шифрования

| Компонент                     | Значение                          | Комментарий                                                           |
| ----------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| **Алгоритм**                  | AES-GCM-256                       | Конфиденциальность + аутентичность                                    |
| **Вектор инициализации (IV)** | 12 байт                           | Генерируется криптографически случайным образом для каждого сообщения |
| **KDF**                       | PBKDF2 + SHA-256                  | 100 000 итераций (оптимизировано для high-entropy input)              |
| **Соль для KDF**              | `${handleId}:${purpose}`          | Обеспечивает уникальность и разделение ключей                         |
| **Тип ключа**                 | `CryptoKey`, `extractable: false` | Невозможно экспортировать через JavaScript                            |

### Поток работы с ключом

```
[Логин / Восстановление аккаунта]
  ↓
Приватный ключ → hashPrivateKey() → importKey(extractable: false) → CryptoKey
  ↓
Сохранение в IndexedDB: StorageService.storeEncryptionKey(identityId, baseKey)
  ↓
Сохранение ссылки в RAM: setSessionCryptoKey(baseKey) [опционально]
  ↓
[Отправка / Получение сообщения]
  ↓
getBaseKey(identityId): RAM → IndexedDB fallback
  ↓
deriveEncryptionKeyFromHash(baseKey, handleId, purpose) → AES-GCM ключ
  ↓
Шифрование / Расшифровка
  ↓
[Перезагрузка страницы]
  ↓
getBaseKey() загружает CryptoKey из IndexedDB → работа продолжается бесшовно
  ↓
[Logout]
  ↓
StorageService.deleteEncryptionKey(identityId) + clearSessionCryptoKey()
```

### Защита от XSS-атак

| Угроза                              | Мера защиты                         | Результат                               |
| ----------------------------------- | ----------------------------------- | --------------------------------------- |
| Кража ключа через `exportKey()`     | `extractable: false`                | Ключ нельзя экспортировать              |
| Чтение ключа из памяти              | Ключ управляется браузером          | Не доступен как `Uint8Array`            |
| Использование ключа злоумышленником | Контекст вкладки + nonce на сервере | Только в рамках активной сессии         |
| Компрометация сервера               | Zero-knowledge архитектура          | Сервер видит только зашифрованные blobs |

---

## 🗄️ Структура данных

### EncryptedStorage (для шифрования)

```typescript
interface EncryptedStorage {
  encrypted: Uint8Array; // Шифротекст (ciphertext)
  iv: Uint8Array; // 12-байтный вектор инициализации
  context: 'message' | 'contact' | 'metadata' | 'file'; // Контекст использования
  timestamp: number; // Время шифрования
  // ❌ version: удалено (одна версия)
  // ❌ salt: удалено (уникальность через handleId в KDF)
  // ❌ authTag: не хранится отдельно (встроен в AES-GCM)
}
```

### Message (в IndexedDB)

```typescript
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  contentType: 'text' | 'image' | 'video' | 'audio' | 'file';

  // Шифрованные данные
  encryptedContent: ArrayBuffer; // Зашифрованное содержимое
  iv: ArrayBuffer; // Вектор инициализации

  // Метаданные
  timestamp: number;
  isOwn: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  editedAt?: number;
  replyToId?: string;
  metadata?: Record<string, any>;

  // Медиа-данные (для не-текстовых сообщений)
  media?: {
    id: string; // Уникальный ID медиа
    mimeType: string; // 'image/jpeg', 'video/mp4', etc.
    size: number; // Размер в байтах
    fileName?: string; // Оригинальное имя файла
    duration?: number; // Для audio/video
    width?: number;
    height?: number;

    // Хранение
    remoteStorageKey?: string; // Путь в S3 (для файлов ≥5MB)
    cachedLocally?: boolean; // Закеширован ли локально
    encryptedLocalContent?: ArrayBuffer; // Если cachedLocally=true

    // Превью (всегда для изображений)
    thumbnail?: {
      encryptedContent: ArrayBuffer;
      width: number;
      height: number;
    };
  };
}
```

### CryptoKeyRecord (в IndexedDB)

```typescript
interface CryptoKeyRecord {
  identityId: string; // Primary key: привязка к пользователю
  encryptionKey: CryptoKey; // Неэкспортируемый ключ (управляется браузером)
  createdAt: number; // Метаданные для отладки
}
```

---

## 🔄 Потоки данных

### 📤 Отправка текстового сообщения

```
1. Пользователь вводит текст → нажимает "Отправить"
2. handleSendMessage (index.tsx):
   ├─ Проверяет наличие user.identity.id
   ├─ Вызывает StorageService.saveEncryptedMessage(
   │    chatId, senderId, text, handleId, isOwn, messageId, identityId
   │  )
3. StorageService.saveEncryptedMessage:
   ├─ getBaseKey(identityId) → CryptoKey (RAM → IndexedDB fallback)
   ├─ deriveEncryptionKeyFromHash(baseKey, handleId, 'message')
   ├─ encryptWithKey(textBytes, encryptionKey) → {encrypted, iv}
   ├─ Сохраняет в IndexedDB: {encryptedContent, iv, context, timestamp}
4. Отправляет зашифрованный контент через WebSocket
5. Обновляет UI: добавляет сообщение в список
```

### 📥 Получение сообщения (через WebSocket)

```
1. handleMessageReceived (index.tsx):
   ├─ Проверяет: это не своё сообщение?
   ├─ Проверяет: есть ли user.identity.id?
   ├─ Вызывает StorageService.saveEncryptedMessage(..., identityId)
2. StorageService:
   ├─ Шифрует и сохраняет в IndexedDB (аналогично отправке)
3. Если чат открыт:
   ├─ Добавляет сообщение в UI (расшифровка при отображении)
```

### 🖼️ Отправка медиа-файла (гибридная модель)

```
1. Пользователь выбирает файл (изображение/видео/аудио/документ)
2. Чтение файла → ArrayBuffer
3. Генерация параметров шифрования:
   ├─ salt = randomBytes(32)  [только для файлов, не для сообщений]
   ├─ iv = randomBytes(12)
   ├─ baseKey = getBaseKey(identityId)
   ├─ encryptionKey = deriveEncryptionKeyFromHash(baseKey, handleId, 'file')
4. Шифрование файла:
   ├─ encryptedFile = encryptWithKey(fileBytes, encryptionKey, iv)
5. Генерация превью (для изображений):
   ├─ thumbnail = resize(image, 200x200)
   ├─ encryptedThumbnail = encryptWithKey(thumbnail, encryptionKey, iv)
6. Решение о хранении:
   ├─ Если encryptedFile.size < 5MB:
   │  ├─ Сохранить encryptedFile локально в IndexedDB
   │  └─ remoteStorageKey = null
   ├─ Если encryptedFile.size ≥ 5MB:
   │  ├─ Запросить presigned URL у бэкенда: POST /s3/upload
   │  ├─ Загрузить encryptedFile в S3 через PUT presigned URL
   │  └─ remoteStorageKey = s3Key
7. Сохранение метаданных в IndexedDB:
   ├─ Message {
   │    contentType: 'image' | 'video' | ...,
   │    media: {
   │      id, mimeType, size, fileName,
   │      remoteStorageKey, cachedLocally,
   │      thumbnail: { encryptedContent, width, height }
   │    },
   │    encryptedContent: (пусто или превью),
   │    iv, timestamp, ...
   │  }
8. Отправка сообщения через WebSocket (только метаданные + ссылка)
```

### 📥 Загрузка и отображение медиа

```
1. Пользователь открывает чат → loadDecryptedMessages(chatId, handleId, identityId)
2. Для каждого сообщения:
   ├─ Если contentType === 'text':
   │  ├─ Расшифровать encryptedContent → текст
   ├─ Если contentType !== 'text':
   │  ├─ Если media.cachedLocally === true:
   │  │  ├─ Расшифровать encryptedLocalContent → файл в памяти
   │  │  ├─ Расшифровать thumbnail → показать превью
   │  ├─ Если media.cachedLocally === false:
   │  │  ├─ Запросить presigned URL: GET /s3/download/{remoteStorageKey}
   │  │  ├─ Скачать encryptedFile через fetch(presignedUrl)
   │  │  ├─ Расшифровать файл → показать / сохранить в кэш если <5MB
   │  │  ├─ Расшифровать thumbnail (всегда в IndexedDB) → показать сразу
3. Отображение в UI:
   ├─ Текст: обычный bubble
   ├─ Изображение: превью → клик → полноэкранный просмотр
   ├─ Видео/Аудио: плеер с controls
   ├─ Документ: иконка + имя файла + кнопка скачивания
```

---

## 🗂️ Структура хранилищ

### IndexedDB (локально, на устройстве)

```
BeSafeDB_<hash(identityId)>
├─ messages (table)
│  ├─ id: string (PK)
│  ├─ chatId: string (index)
│  ├─ contentType: 'text' | 'image' | 'video' | 'audio' | 'file'
│  ├─ encryptedContent: ArrayBuffer
│  ├─ iv: ArrayBuffer
│  ├─ media?: { ... }  // см. интерфейс выше
│  ├─ timestamp: number (index)
│  ├─ isOwn: boolean
│  └─ ... остальные поля
│
├─ cryptoKeys (table)
│  ├─ identityId: string (PK)
│  ├─ encryptionKey: CryptoKey (неэкспортируемый)
│  └─ createdAt: number
│
├─ contacts (table)
│  └─ ... (без изменений)
│
└─ publicKey (table)
   └─ ... (без изменений)
```

### S3 (Tebi, облачное хранилище)

```
s3://besafe.backet/
└── users/
    └── {identityId}/
        ├── avatar.{png|jpg|webp}           # Аватар профиля
        ├── media/
        │   ├── {mediaId}-original.{ext}    # Полноразмерный зашифрованный файл
        │   ├── {mediaId}-thumbnail.jpg     # Зашифрованное превью (для изображений)
        │   └── {mediaId}-metadata.json     # Зашифрованные метаданные (опционально)
        └── documents/
            └── {mediaId}-original.pdf      # Зашифрованные документы
```

**Важно**: Все файлы в S3 хранятся **только в зашифрованном виде**. Сервер не имеет доступа к ключам расшифровки.

---

## 🔧 API эндпоинты (бэкенд)

### Работа с файлами (S3)

| Метод    | Эндпоинт            | Описание                              | Аутентификация       |
| -------- | ------------------- | ------------------------------------- | -------------------- |
| `POST`   | `/s3/upload`        | Получить presigned URL для загрузки   | Cookies + identityId |
| `GET`    | `/s3/download/:key` | Получить presigned URL для скачивания | Cookies + identityId |
| `DELETE` | `/s3/:key`          | Удалить файл (только свой)            | Cookies + identityId |

**Пример запроса на загрузку**:

```typescript
// Получение presigned URL
const response = await fetch('/s3/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    fileType: 'image', // 'image' | 'video' | 'audio' | 'document'
    contentType: 'image/jpeg',
    filename: 'photo.jpg', // опционально, для метаданных
  }),
});

const { uploadUrl, fileKey } = await response.json();

// Загрузка зашифрованного файла в S3
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: encryptedFile, // ArrayBuffer
});
```

### Профиль и метаданные

| Метод   | Эндпоинт                | Описание                                                     |
| ------- | ----------------------- | ------------------------------------------------------------ |
| `GET`   | `/auth/profile`         | Получить профиль (аватар определяется по наличию файла в S3) |
| `PATCH` | `/profile/display-name` | Обновить отображаемое имя                                    |

---

## 📦 Расчёт использования хранилища

### На одного активного пользователя (30 дней)

#### IndexedDB (локальный кэш)

| Тип данных                    | Объём       | Комментарий                              |
| ----------------------------- | ----------- | ---------------------------------------- |
| Текстовые сообщения (1000 шт) | ~500 KB     | ~500 байт на сообщение                   |
| Превью изображений (200 шт)   | ~50 MB      | 200x200px, зашифрованные                 |
| Малые файлы <5MB (50 шт)      | ~100 MB     | В среднем 2 MB на файл                   |
| Метаданные и индексы          | ~10 MB      | Служебные данные Dexie                   |
| **ИТОГО**                     | **~160 MB** | ✅ В пределах квоты браузера (50-100 GB) |

#### S3 (облачное хранилище)

| Тип данных                          | Объём       | Комментарий                     |
| ----------------------------------- | ----------- | ------------------------------- |
| Полноразмерные изображения (200 шт) | ~600 MB     | ~3 MB на изображение            |
| Видео (20 шт)                       | ~2 GB       | ~100 MB на видео                |
| Аудио (50 шт)                       | ~500 MB     | ~10 MB на аудио                 |
| Документы (100 шт)                  | ~100 MB     | ~1 MB на документ               |
| **ИТОГО**                           | **~3.2 GB** | ✅ Масштабируется неограниченно |

### Квоты браузеров для IndexedDB

| Браузер | Примерная квота      | Примечание                  |
| ------- | -------------------- | --------------------------- |
| Chrome  | 50 GB (6% от диска)  | Может запрашивать больше    |
| Firefox | 10 GB (по умолчанию) | Настраивается пользователем |
| Safari  | 50 GB                | Ограничения на iOS          |
| Edge    | 50 GB                | Аналогично Chrome           |

**Вывод**: Локальный кэш ~160 MB на пользователя — безопасно и устойчиво.

---

## 🛡️ Чек-лист безопасности

- [ ] Все файлы шифруются на клиенте **до** загрузки в S3
- [ ] Ключи шифрования — `CryptoKey` с `extractable: false`
- [ ] Ключи хранятся в IndexedDB, привязаны к `identityId`
- [ ] Presigned URLs имеют короткий срок жизни (15 минут)
- [ ] Сервер не имеет доступа к приватным ключам или хэшам
- [ ] После расшифровки файл проверяется по checksum (SHA-256)
- [ ] Орфанные файлы в S3 удаляются (нет ссылки в Message)
- [ ] Пользователь может удалить только свои файлы
- [ ] Дедупликация по хэшу **зашифрованного** контента (не раскрывает наличие файла)
- [ ] При logout: ключ удаляется из IndexedDB и RAM, сессия закрывается

---

## 🗓️ План реализации по фазам

### Фаза 1: Подготовка бэкенда (Неделя 1)

**Задачи**:

- [ ] Расширить `MessageMetadata` entity: добавить `mediaId`, `contentType`
- [ ] Создать/обновить `Media` entity: `storageKey`, `fileHash`, `variants`, `messageId`
- [ ] Реализовать эндпоинты S3: `/s3/upload`, `/s3/download/:key`, `/s3/:key`
- [ ] Добавить валидацию: пользователь может работать только со своими файлами
- [ ] Реализовать генерацию presigned URLs с TTL 15 минут
- [ ] Добавить эндпоинт проверки дедупликации по `fileHash`

**Результат**: Готовый бэкенд для приёма и отдачи зашифрованных файлов.

---

### Фаза 2: Обновление фронтенд-схемы (Неделя 1)

**Задачи**:

- [ ] Обновить интерфейс `Message` в `@/lib/db/schema.ts` (добавить `media?`)
- [ ] Обновить Dexie схему в `@/lib/db/db.ts` (проверить миграцию)
- [ ] Расширить `StorageService`:
  - [ ] `encryptBinaryData()` / `decryptBinaryData()` — проверить сигнатуры
  - [ ] Методы для работы с превью: `generateThumbnail()`, `encryptThumbnail()`
- [ ] Добавить утилиты для расчёта размера файла и проверки квоты IndexedDB

**Результат**: Фронтенд готов к работе с медиа-сообщениями.

---

### Фаза 3: Реализация потоков загрузки/скачивания (Неделя 2)

**Задачи**:

- [ ] Реализовать `uploadMediaMessage()`:
  - [ ] Чтение файла → ArrayBuffer
  - [ ] Шифрование с `deriveEncryptionKeyFromHash(baseKey, handleId, 'file')`
  - [ ] Генерация превью для изображений
  - [ ] Решение: локально или S3 (порог 5MB)
  - [ ] Загрузка в S3 при необходимости
  - [ ] Сохранение метаданных в IndexedDB
- [ ] Реализовать `loadMediaMessage()`:
  - [ ] Проверка локального кэша
  - [ ] Загрузка из S3 при необходимости
  - [ ] Расшифровка и отображение
  - [ ] Кэширование малых файлов
- [ ] Интеграция с UI:
  - [ ] Компонент для отображения изображений (превью + лайтбокс)
  - [ ] Плеер для видео/аудио
  - [ ] Карточка для документов (иконка + скачивание)
  - [ ] Индикаторы загрузки и ошибок

**Результат**: Полный цикл отправки и получения медиа-сообщений.

---

### Фаза 4: Оптимизация и тестирование (Неделя 3)

**Задачи**:

- [ ] Тестирование всех типов файлов (изображения, видео, аудио, документы)
- [ ] Проверка дедупликации: одинаковые файлы не загружаются повторно
- [ ] Тестирование кэширования: малые файлы сохраняются локально
- [ ] Проверка очистки кэша: старые файлы удаляются при нехватке места
- [ ] Тестирование кросс-девайс синхронизации (метаданные + ссылки)
- [ ] Нагрузочное тестирование: медленные сети, большие файлы
- [ ] Мониторинг квоты IndexedDB: предупреждение пользователя при 80% заполнения
- [ ] Security audit: проверка, что ключи не утекают, сервер не видит plaintext

**Результат**: Готовый к продакшену функционал мультимедиа.

---

## ⚠️ Что НЕ делать

```
❌ НЕ хранить приватные ключи или их хэши в localStorage
❌ НЕ шифровать файлы на сервере (только клиентское шифрование)
❌ НЕ передавать ключи шифрования через сеть
❌ НЕ смешивать зашифрованные и незашифрованные данные в одном хранилище
❌ НЕ забывать очищать кэш IndexedDB при нехватке места
❌ НЕ использовать Option 5 (Multi-S3) без регуляторного требования
❌ НЕ хранить authTag/salt/version отдельно (они устарели)
```

---

## ✅ Что ОБЯЗАТЕЛЬНО делать

```
✅ Шифровать все файлы на клиенте перед загрузкой в S3
✅ Использовать CryptoKey с extractable: false для всех операций
✅ Передавать identityId и handleId явно из React-контекста в сервисы
✅ Проверять checksum файла после расшифровки
✅ Реализовать дедупликацию по хэшу зашифрованного контента
✅ Очищать орфанные файлы в S3 (нет ссылки в Message)
✅ Мониторить квоту IndexedDB и предупреждать пользователя
✅ Кэшировать превью изображений всегда, малые файлы (<5MB) — опционально
✅ Использовать presigned URLs с TTL 15 минут
✅ Удалять ключи из IndexedDB и RAM при logout
```

---

## 🧪 План тестирования

### Функциональные тесты

| Сценарий                      | Ожидаемый результат                                                      |
| ----------------------------- | ------------------------------------------------------------------------ |
| Отправка текстового сообщения | Сохраняется в IndexedDB, отображается, расшифровывается после рефреша    |
| Отправка изображения <5MB     | Сохраняется локально, превью отображается сразу, полный размер по клику  |
| Отправка изображения ≥5MB     | Загружается в S3, превью локально, полный размер скачивается по запросу  |
| Отправка видео                | Превью/постер локально, видео стримится/скачивается из S3                |
| Получение сообщения оффлайн   | Если файл в кэше — отображается, если нет — показывается заглушка        |
| Перезагрузка страницы         | Все сообщения загружаются и расшифровываются автоматически               |
| Logout                        | Ключ удаляется, сообщения остаются зашифрованными, недоступны для чтения |
| Вход на другом устройстве     | Метаданные синхронизируются, файлы скачиваются из S3 по запросу          |

### Security-тесты

| Сценарий                           | Проверка                                                              |
| ---------------------------------- | --------------------------------------------------------------------- |
| Попытка `exportKey()` на CryptoKey | Выбрасывается `InvalidAccessError`                                    |
| XSS-инъекция в чат                 | Не может прочитать ключи, только использовать в контексте вкладки     |
| Перехват presigned URL             | URL истекает через 15 минут, повторное использование невозможно       |
| Компрометация сервера              | Злоумышленник видит только зашифрованные blobs, не может расшифровать |
| Доступ к IndexedDB через DevTools  | Видны только зашифрованные ArrayBuffer, ключи неэкспортируемы         |

### Нагрузочные тесты

| Параметр                                       | Целевое значение                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Время шифрования файла 10MB                    | < 2 секунды на среднем устройстве                                |
| Время загрузки превью изображения              | < 500ms (из локального кэша)                                     |
| Время скачивания файла 100MB из S3             | Зависит от сети, но с прогресс-баром                             |
| Потребление памяти при расшифровке             | Не более 2x от размера файла (освобождается после использования) |
| Квота IndexedDB при 1000 сообщений + 200 медиа | < 200 MB                                                         |

---

## 🔮 Возможные улучшения в будущем

### Краткосрочные (1-3 месяца)

- [ ] Поддержка голосовых сообщений с waveform-визуализацией
- [ ] Автоматическое сжатие изображений перед шифрованием (настраиваемое качество)
- [ ] Пакетная загрузка нескольких файлов в одном сообщении
- [ ] Предпросмотр документов (PDF, DOCX) без скачивания

### Среднесрочные (3-6 месяцев)

- [ ] End-to-end шифрование для групповых чатов (расширение ключевой модели)
- [ ] Синхронизация ключей между устройствами через зашифрованный канал (опционально)
- [ ] Поддержка потокового шифрования для очень больших файлов (>1GB)

### Долгосрочные (6+ месяцев)

- [ ] Интеграция с аппаратными ключами (Secure Enclave, TPM) для хранения CryptoKey
- [ ] Поддержка постквантовой криптографии (алгоритмы, устойчивые к квантовым атакам)
- [ ] Децентрализованное хранилище (IPFS, Filecoin) как альтернатива S3

---

## 📎 Приложения

### A. Пример миграции БД

```sql
-- Удаление устаревших полей из таблицы messages
ALTER TABLE messages
  DROP COLUMN IF EXISTS "salt",
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "authTag";

-- Добавление новых полей для медиа (если используется SQL-бэкенд для метаданных)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS "media" JSONB,
  ADD COLUMN IF NOT EXISTS "content_type" VARCHAR(20) DEFAULT 'text';

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_messages_chatid_timestamp ON messages(chat_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_content_type ON messages(content_type);
```

### B. Пример кода: шифрование файла

```typescript
import { deriveEncryptionKeyFromHash } from '@/lib/crypto';
import { StorageService } from '@/services/storage.service';

async function encryptFileForUpload(
  file: File,
  handleId: string,
  identityId: string
): Promise<{
  encrypted: Uint8Array;
  iv: Uint8Array;
  checksum: string;
}> {
  // 1. Чтение файла
  const fileBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(fileBuffer);

  // 2. Получение базового ключа
  const baseKey = await StorageService.getBaseKey(identityId);

  // 3. Деривация контекстного ключа
  const encryptionKey = await deriveEncryptionKeyFromHash(
    baseKey,
    handleId,
    'file' // purpose для разделения ключей
  );

  // 4. Генерация IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 5. Шифрование
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, fileBytes);

  // 6. Расчёт checksum для дедупликации
  const checksumBuffer = await crypto.subtle.digest('SHA-256', encrypted);
  const checksum = Array.from(new Uint8Array(checksumBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    encrypted: new Uint8Array(encrypted),
    iv,
    checksum,
  };
}
```

### C. Пример кода: загрузка в S3

```typescript
async function uploadToS3(
  encryptedFile: Uint8Array,
  presignedUrl: string,
  contentType: string
): Promise<void> {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': encryptedFile.length.toString(),
    },
    body: encryptedFile,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
  }
}
```

---

## 🎯 Заключение

Реализация гибридной модели мультимедиа-хранилища для BeSafeChat:

- 🔐 **Сохраняет принципы E2EE**: все данные шифруются на клиенте, ключи не покидают устройство
- ⚡ **Обеспечивает отличный UX**: оффлайн-доступ к последним сообщениям, мгновенное отображение превью
- 📦 **Масштабируется**: от личных чатов до корпоративных решений с терабайтами данных
- 🛡️ **Защищена от современных угроз**: XSS, компрометация сервера, утечки ключей
- 🧩 **Имеет чистую архитектуру**: явные зависимости, тестируемость, возможность эволюции

**Следующий шаг**: Приступить к реализации Фазы 1 (бэкенд) и параллельно подготовить фронтенд-схему.

---

> 📄 **История версий**  
> **v2.0** (Февраль 2026): Полная актуализация под CryptoKey-архитектуру, удаление устаревших полей, явная передача identityId, рекомендации по гибридному хранению.  
> **v1.0** (Исходная версия): Базовый план с сравнением опций хранения.

> 🗑️ **Устаревшие документы**:
>
> - `media-storage-architecture.md` → заменён этим документом
> - `media-storage-comparison.md` → заменён этим документом  
>   _(Архивные версии сохранены в `plans/archive/`)_
