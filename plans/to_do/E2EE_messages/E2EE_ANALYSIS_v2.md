# 📋 Анализ: E2EE_ENCRYPTION_SYSTEM_v2.md vs Текущая реализация

**Дата анализа:** 2026-02-17  
**Статус:** ✅ ГОТОВ К РЕАЛИЗАЦИИ

---

## 1. Состояние текущей реализации (Inventory)

### 1.1 ✅ Что уже реализовано (Foundation)

#### Frontend Crypto (`frontend/app/lib/crypto/`)

| Компонент | Файл | Статус | Примечание |
|-----------|------|--------|-----------|
| **Ed25519 Signatures** | `core/signatures.ts` | ✅ Готово | Sign/verify message, recovery signature |
| **Seed Generation (BIP39)** | `core/key-derivation.ts` | ✅ Готово | 12-слово seed generation/validation |
| **Key Derivation from Seed** | `core/key-derivation.ts` | ✅ Готово | BIP39 → Ed25519 private key |
| **Key Hashing (hPK)** | `core/key-derivation.ts#L378-L381` | ✅ Готово | SHA-256(privateKey) → hPK |
| **Cloud Encryption (Argon2id + AES-GCM)** | `core/key-derivation.ts#L160-L219` | ✅ Готово | Seed backup с checksum validation |
| **Cloud Decryption** | `core/key-derivation.ts#L257-L354` | ✅ Готово | С checksum verification |
| **AES-256-GCM Encryption** | `core/encryption.ts` | ✅ Готово | `encryptWithKey`, `decryptWithKey` |
| **Key Derivation from Hash** | `core/key-derivation.ts#L413-L446` | ✅ Готово | `deriveEncryptionKeyFromHash(hPK, handleId, purpose)` |
| **IndexedDB Support** | `dexie` (frontend/package.json) | ✅ Готово | База для хранения ключей |
| **PBKDF2 KDF** | `core/key-derivation.ts#L224-L252` | ✅ Готово | Для derivation из passphrase |
| **Argon2id KDF** | `core/key-derivation.ts#L131-L155` | ✅ Готово | Для seed encryption |
| **HKDF KDF** | ❌ НЕ НАЙДЕНО | ⏳ ТРЕБУЕТСЯ | Для per-message key derivation |

#### Backend Infrastructure (`backend/src/domains/`)

| Компонент | Файл | Статус | Примечание |
|-----------|------|--------|-----------|
| **Ed25519 Verification** | `auth/services/challenge.service.ts` | ✅ Готово | Server-side signature verification |
| **Public Key Registry** | `identity/services/identity.service.ts` | ✅ Готово | Хранение публичных ключей |
| **Chat Entity** | `chat/chat.entity.ts` | ⏳ Частично | Есть комментарии о Signal Protocol, но не реализовано |
| **Pre-keys Storage** | ❌ НЕ РЕАЛИЗОВАНО | ⏳ ТРЕБУЕТСЯ | handle_prekeys table + endpoints |
| **Group Chat Info** | ❌ НЕ РЕАЛИЗОВАНО | ⏳ ТРЕБУЕТСЯ | group_chat_info + group_members tables |

#### Криптографические библиотеки

| Библиотека | Frontend | Backend | Использование |
|----------|----------|---------|---------------|
| `@noble/ed25519` | ✅ v3.0.0 | ✅ v3.0.0 | Ed25519 signatures |
| `@noble/hashes` | ✅ v2.0.1 | ✅ v2.0.1 | SHA-256, SHA-512 |
| `@scure/bip39` | ✅ v2.0.1 | ❌ | BIP39 seed |
| `hash-wasm` | ✅ v4.12.0 | ✅ v4.12.0 | Argon2id KDF |
| ECDH / X3DH | ❌ ❌ | ❌ ❌ | **ТРЕБУЕТСЯ** |
| HKDF | ❌ ❌ | ❌ ❌ | **ТРЕБУЕТСЯ** |

---

### 1.2 ❌ Что отсутствует (Gaps)

#### Критические для X3DH и групповых чатов

| Функция | Где нужна | Библиотека | Приоритет |
|---------|-----------|-----------|-----------|
| **ECDH (Curve25519)** | Frontend + Backend | `@noble/curves` или `tweetnacl.js` | 🔴 КРИТИЧНО |
| **X3DH Protocol** | Frontend (1:1 чаты) | Manual implementation | 🔴 КРИТИЧНО |
| **HKDF** | Frontend + Backend | `@noble/hashes/hkdf` | 🔴 КРИТИЧНО |
| **Group Key Exchange** | Frontend + Backend | Manual implementation | 🟠 ВАЖНО |
| **Pre-key Management** | Frontend + Backend | Custom service | 🟠 ВАЖНО |
| **WebSocket Group Routing** | Backend (messages) | Custom service | 🟠 ВАЖНО |

---

## 2. Анализ E2EE_ENCRYPTION_SYSTEM_v2.md на корректность

### 2.1 ✅ Архитектурные решения (правильные)

| Решение | Обоснование | Статус |
|---------|------------|--------|
| **Simple Fanout для групп (v2)** | Простая реализация, масштабируется до 100 участников | ✅ ПРАВИЛЬНО |
| **X3DH для 1:1** | Стандартный протокол Signal, доказанный временем | ✅ ПРАВИЛЬНО |
| **Double Ratchet для forward secrecy** | Один из лучших алгоритмов для per-message security | ✅ ПРАВИЛЬНО |
| **HKDF для key derivation** | RFC 5869 стандарт, криптографически безопасный | ✅ ПРАВИЛЬНО |
| **AES-256-GCM для encryption** | AEAD cipher, NIST рекомендованный | ✅ ПРАВИЛЬНО |
| **Lazy activation (30 дней)** | Удобный UX при сохранении security | ✅ ПРАВИЛЬНО |
| **hPK в памяти только** | Защита от XSS-атак на локальное хранилище | ✅ ПРАВИЛЬНО |
| **OTK одноразовые** | Предотвращает повторное использование | ✅ ПРАВИЛЬНО |

### 2.2 ⚠️ Потенциальные проблемы (Risk Assessment)

#### **2.2.1 ECDH Curve Choice (Часть v2)**

**Текст в v2:**
> ```
> CK = HKDF(DH1 || DH2 || DH3 || DH4, info="chat")
> где DH = ECDH (Elliptic Curve Diffie-Hellman)
> ```

**Проблема 1: Curve не указана 🔴 КРИТИЧНО**

```
❌ ТЕКУЩИЙ СТАТУС: 
   Не указано, какую кривую использовать (P-256? Curve25519? Ed448?)

✅ РЕКОМЕНДАЦИЯ:
   "ECDH with Curve25519" или "Hybrid: Ed25519 для signing + Curve25519 для DH"
   
   Почему Curve25519?
   - Рекомендован для E2EE (Signal, Whatsapp, Telegram)
   - Безопасен от timing attacks
   - Отличная performance
```

**Решение для v2:**
Обновить в v2.md раздел 4.1 и 5.1:

```markdown
### 5.1 Структура ключей участников (ОБНОВЛЕНО)

**Alice & Bob (оба участника):**
- `IK` (Identity Key — Ed25519, долгоживущий, для подписей)
- `SPK` (Signed Pre-Key — Curve25519, живет 30 дней)
- `OTK` (One-Time Key — Curve25519, потребляется один раз)
- `EK` (Ephemeral Key — Curve25519, один раз за чат)

ECDH операции используют **Curve25519** (X25519 для DH)
```

#### **2.2.2 Key Size и Encoding (Часть v2)**

**Текущий текст:**
```typescript
DH1 = DH(IK_A, SPK_B)
CK = HKDF(DH1 || DH2 || DH3 || DH4, info="chat")
```

**Проблема 2: DH output size не определён 🔴 ВАЖНО**

```
❌ ТЕКУЩИЙ СТАТУС:
   DH(Curve25519) выдает 32 байта
   Но в коде не указано, как их конкатенировать

✅ РЕКОМЕНДАЦИЯ:
   DH1 = X25519(IK_A_scalar, SPK_B) → 32 bytes
   DH2 = X25519(EK_A_scalar, IK_B) → 32 bytes
   DH3 = X25519(EK_A_scalar, SPK_B) → 32 bytes
   DH4 = X25519(IK_A_scalar, OTK_B) → 32 bytes
   
   Total = 128 bytes
   CK = HKDF-SHA256(IKM=DH1||DH2||DH3||DH4, salt=null, length=32)
```

#### **2.2.3 GroupSecret Derivation (Часть v2, Group Chats)**

**Текущий текст:**
```typescript
groupSecret = SHA-256(random(32) || timestamp || groupId)
```

**Проблема 3: Слабая дериватция 🟠 НЕБЕЗОПАСНО**

```
❌ ТЕКУЩИЙ СТАТУС:
   Просто конкатенирует и хэширует
   Не использует HKDF
   Timestamp может быть предсказуем

✅ РЕКОМЕНДАЦИЯ:
   groupSecret = HKDF-SHA256(
     IKM = random(32),           // Entropy source
     salt = "besafechat-group",  // Context string
     info = groupId,             // Personalization
     length = 32
   )
```

#### **2.2.4 Message Counter Synchronization (Критична для групп)**

**Проблема 4: Race condition при параллельных сообщениях 🟠 ПОТЕНЦИАЛЬНО ОПАСНО**

```
Сценарий:
─────────
Alice отправляет сообщение #1
Bob отправляет сообщение #1 одновременно (не знает о сообщении Alice)

Обоих используют messageNumber=1!
→ Конфликт в IndexedDB или duplicate decryption keys

РЕШЕНИЕ:
─────────
Две стратегии:

Стратегия A: Per-sender counters (рекомендуется)
  messageNumber НЕ глобальный, а per-sender
  
  IndexedDB: {
    chatId, senderId, messageNumber,
    ciphertext, ...
  }
  
  Так: Alice#1 ≠ Bob#1, разные ключи
  
  ✅ Правильно для групп

Стратегия B: Server-assigned counters
  Сервер выдает глобальный messageNumber при получении
  
  Но требует round-trip: send → server → get number → ack
  ❌ Медленно для UX
```

**В v2 уже есть намёк:**
```typescript
messageCounterPerParticipant?: {
  [participantId]: number  // Для отслеживания порядка
}
```
✅ **Это правильный подход!**

---

## 3. Проблемы в текущей реализации кода

### 3.1 ❌ Отсутствует HKDF implementation

**Местоположение:** `frontend/app/lib/crypto/core/`

**Что нужно:**
```typescript
// core/key-derivation.ts или новый файл kdf.ts

import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

export async function deriveKeyWithHKDF(
  ikm: Uint8Array,        // Input Key Material
  salt: Uint8Array | null, // Salt (optional)
  info: Uint8Array,        // Info string
  length: number = 32      // Output length
): Promise<Uint8Array> {
  return hkdf(sha256, ikm, salt, info, length);
}
```

**Использование в v2:**
- Per-message key derivation в 1:1 чатах
- participantKey derivation в групповых чатах
- Group rekey operations

---

### 3.2 ❌ Отсутствует X3DH Service (Frontend)

**Местоположение:** Новый файл `frontend/app/lib/crypto/core/x3dh.ts`

**Что нужно:**
```typescript
import { x25519, x25519Public } from '@noble/curves/x25519';
import { ed25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

export interface X3DHPreKeys {
  ikPk: Uint8Array;        // Identity key public
  spkPk: Uint8Array;       // Signed pre-key public
  spkSig: Uint8Array;      // Signature over SPK
  otkPks: Uint8Array[];    // One-time key publics
}

export async function performX3DH(
  alice: { ikSk: Uint8Array },      // Alice's identity private key
  bob: X3DHPreKeys,                  // Bob's pre-keys
  selectedOtkPk: Uint8Array          // Which OTK Bob used
): Promise<Uint8Array> {
  // 1. Generate ephemeral key
  const ekSk = x25519.privateKey(randomBytes(32));
  const ekPk = x25519Public(ekSk);

  // 2. Perform 4 DH operations
  const dh1 = x25519(ikSk, bob.spkPk);      // IK_A → SPK_B
  const dh2 = x25519(ekSk, bob.ikPk);       // EK_A → IK_B
  const dh3 = x25519(ekSk, bob.spkPk);      // EK_A → SPK_B
  const dh4 = x25519(ikSk, selectedOtkPk);  // IK_A → OTK_B

  // 3. Concatenate DH outputs
  const ikm = concatUint8Arrays([dh1, dh2, dh3, dh4]);

  // 4. Derive chat key
  const ck = hkdf(sha256, ikm, null, new TextEncoder().encode("chat"), 32);

  return ck;
}
```

### 3.3 ❌ Отсутствует Pre-key Management (Frontend)

**Местоположение:** Новый файл `frontend/app/lib/crypto/prekey-manager.ts`

**Что нужно:**
```typescript
export async function generateAndStorePreKeys(hPK: Uint8Array): Promise<{
  spkPk: Uint8Array;
  spkSig: Uint8Array;
  otkPks: Uint8Array[];
}> {
  // 1. Generate SPK (Signed Pre-Key)
  const spkSk = x25519.privateKey(randomBytes(32));
  const spkPk = x25519Public(spkSk);
  const spkSig = await signMessage(ikSk, spkPk); // Sign with identity key

  // 2. Generate 100 OTKs
  const otkSks: Uint8Array[] = [];
  const otkPks: Uint8Array[] = [];
  for (let i = 0; i < 100; i++) {
    const sk = x25519.privateKey(randomBytes(32));
    otkSks.push(sk);
    otkPks.push(x25519Public(sk));
  }

  // 3. Encrypt all under hPK and store in IndexedDB
  const derivedKey = await deriveEncryptionKeyFromHash(hPK, handleId, "prekeys");
  const encrypted = await encryptWithKey(
    concatUint8Arrays(otkSks),
    derivedKey
  );

  await db.sessionPreKeys.put({
    spk_pk: spkPk,
    spk_sk_encrypted: encrypted.encrypted,
    spk_sk_iv: encrypted.iv,
    otk_pks: otkPks,
    otk_sks_encrypted: encrypted.encrypted, // Все в одном шифротексте
    created_at: Date.now(),
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000
  });

  return { spkPk, spkSig, otkPks };
}
```

### 3.4 ❌ Отсутствует Pre-keys API endpoints (Backend)

**Местоположение:** Новый файл `backend/src/domains/crypto/prekeys.controller.ts`

**Что нужно:**
```typescript
@Controller('crypto/prekeys')
export class PrekeysController {
  constructor(private readonly prekeysService: PrekeysService) {}

  @Post('upload')
  async uploadPreKeys(@Body() dto: UploadPreKeysDto) {
    // Store in handle_prekeys table
  }

  @Get(':handleId')
  async getPreKeys(@Param('handleId') handleId: string) {
    // Fetch from handle_prekeys table
    // Return: { spk_pk, spk_signature, otk_pks, prekey_id }
  }

  @Post('rotate')
  async rotatePreKeys(@CurrentUser() user: User) {
    // Mark old prekeys as expired
    // Trigger frontend to generate new ones
  }
}
```

### 3.5 ❌ Отсутствует Group Chat Service (Backend)

**Местоположение:** Новый файл `backend/src/domains/crypto/group-chat.service.ts`

**Что нужно:**
```typescript
@Injectable()
export class GroupChatService {
  async createGroupChat(
    initiatorId: string,
    participantIds: string[]
  ): Promise<{ chatId: string; groupSecret: string }> {
    // 1. Create group_chat_info record
    // 2. Add group_members records
    // 3. Return encrypted groupSecret for each participant
  }

  async addMember(groupChatId: string, newMemberId: string) {
    // 1. Add to group_members
    // 2. Trigger rekey (derive new group secret)
  }

  async removeMember(groupChatId: string, memberId: string) {
    // 1. Remove from group_members
    // 2. Trigger rekey ВАЖНО: старые сообщения reader'а должны быть защищены
  }
}
```

### 3.6 ⚠️ Database schema требуется обновления

**Файл:** `backend/src/db/migrations/` (новые миграции)

**Требуемые таблицы:**
```sql
-- 1. handle_prekeys (для X3DH)
CREATE TABLE handle_prekeys (...)

-- 2. used_otkeys (для tracking OTK consumption)
CREATE TABLE used_otkeys (...)

-- 3. group_chat_info (для групповых чатов)
CREATE TABLE group_chat_info (...)

-- 4. group_members (состав группы)
CREATE TABLE group_members (...)

-- 5. chat_message_counters (для track per-sender message numbers)
CREATE TABLE chat_message_counters (...)
```

---

## 4. Проверка Math и Криптографии (Critical Review)

### 4.1 ✅ X3DH Math (Правильно)

```
DH1 = DH(IK_A.sk, SPK_B.pk)  → 32 bytes (Curve25519 result)
DH2 = DH(EK_A.sk, IK_B.pk)   → 32 bytes
DH3 = DH(EK_A.sk, SPK_B.pk)  → 32 bytes
DH4 = DH(IK_A.sk, OTK_B.pk)  → 32 bytes
─────────────────────────────
Total IKM = 128 bytes

CK = HKDF-SHA256(128, null, info="chat", 32) → 32 bytes ✅
```

### 4.2 ⚠️ Group Key Exchange Math (Требует уточнения)

**Текущий текст (v2):**
```
groupSecret = SHA-256(random(32) || timestamp || groupId)
participantKey_i = HKDF(groupSecret, salt=participantId)
```

**Проблемы:**
1. SHA-256 одного раза недостаточно ❌
2. Timestamp предсказуем ❌
3. Не используется HKDF для группового secret ❌

**Правильно:**
```
groupSecret = HKDF(
  IKM = random(32),
  salt = "besafechat-group-v1",
  info = groupId,
  length = 32
) → 32 bytes

participantKey_i = HKDF(
  IKM = groupSecret,
  salt = null,
  info = participantId + "participant",
  length = 32
) → 32 bytes

messageKey_i = HKDF(
  IKM = participantKey_i,
  salt = null,
  info = messageNumber.toString() + "message",
  length = 32
) → 32 bytes ✅
```

### 4.3 ✅ Per-Message Encryption (Правильно)

```
For message N:
messageKey = HKDF(chatKey, salt=N, info="BeChat.MessageKey.v1")
IV = random(12 bytes)
ciphertext = AES-256-GCM(message, messageKey, IV)

Length: 32-byte key, 12-byte IV, 16-byte auth tag ✅
```

---

## 5. Архитектурные Issue & Solutions

### 5.1 🔴 КРИТИЧНО: Curve Choice в X3DH

**Issue:**
```
v2 говорит "ECDH" но не указывает curve
```

**Solution:**
```markdown
**ОБНОВИТЬ В V2:**

§ 5.1 Структура ключей:

**Криптографическая схема:**
- Ed25519 для идентификации и подписей (долгоживущих)
- Curve25519 (X25519) для Diffie-Hellman (DH) операций

**Ключи:**
- IK (Identity Key): Ed25519 пара
- SPK (Signed Pre-Key): Curve25519 пара (подписана Ed25519)
- OTK (One-Time Key): Curve25519 пара
- EK (Ephemeral Key): Curve25519 пара
```

### 5.2 🟠 ВАЖНО: Message Counter Strategy

**Current v2:**
```
messageNumber (глобальный счётчик на чат)
```

**Problem:**
```
Параллельные сообщения → конфликт counter
```

**Solution (уже в v2, нужно уточнить):**
```
messageCounterPerParticipant: {
  [senderId]: messageNumber
}

Каждый sender имеет свой counter
Alice#1, Bob#1, Charlie#1 → разные ключи шифрования ✅
```

### 5.3 🟠 ВАЖНО: Simple Fanout Scaling

**Current v2:**
```
"Масштабируется до 100 участников"
```

**Реальность:**
```
N участников = N шифротекстов
100 участников × 1MB сообщение = 100MB payload
Network: OK (HTTP)
Storage: OK (база даст)
Computation: OK (~100ms на client)

Более проблемный случай:
1000 сообщений × 100 участников = 100K шифротекстов в день
```

**Вердикт:** ✅ Simple Fanout OK для 100 участников, достаточно для v2

---

## 6. Security Review (Threat Model)

### 6.1 ✅ Защищенные атаки

| Атака | Защита | Оценка |
|-------|--------|--------|
| **Man-in-the-Middle (MITM)** | X3DH + подписи | ✅ Защищено |
| **Сервер читает сообщения** | E2EE шифрование | ✅ Защищено |
| **Кража seed (cloud mode)** | Argon2id + password | ✅ Защищено |
| **XSS атака на hPK** | hPK только в памяти | ✅ Защищено |
| **OTK replay** | one-time consumption tracking | ✅ Защищено |
| **Forward secrecy (1:1)** | Per-message HKDF | ✅ Защищено |

### 6.2 ⚠️ Ограниченная защита (Acceptable)

| Атака | Защита | Статус | Комментарий |
|-------|--------|--------|------------|
| **Удалённый юзер читает старые сообщения (группа)** | Rekeying | ⚠️ Требует явного действия | Не automatic |
| **Компрометация IndexedDB + hPK** | Нет | ⚠️ Есть риск | Требует XSS + timing |
| **Brute-force password (cloud)** | Argon2id (3 iterations) | ⚠️ Средний | Можно усилить до 5-10 iter |

### 6.3 🔴 НЕ ЗАЩИЩЕНО

| Атака | Причина | Решение |
|-------|---------|---------|
| **Quantum computers** | Не quantum-resistant | Future: PQC migration |
| **Metaданные (кто с кем чатит)** | E2EE не скрывает участников | Future: Mixnet или Tor |

---

## 7. Implementation Roadmap (детализированное)

### Этап 1: HKDF + X3DH Infrastructure (2-3 недели)

```
НЕДЕЛЯ 1:
─────────
Day 1-2:  Add @noble/hashes/hkdf to dependencies
Day 3:    Implement HKDF wrapper functions
Day 4-5:  Tests для HKDF
Day 6-7:  Code review & documentation

НЕДЕЛЯ 2:
─────────
Day 1-2:  Install @noble/curves (Curve25519)
Day 3-4:  Implement X3DH service (frontend)
Day 5-6:  Tests для X3DH
Day 7:    Integration tests

НЕДЕЛЯ 3:
─────────
Day 1-2:  Pre-key generation & storage
Day 3-4:  Backend endpoints (/crypto/prekeys/*)
Day 5-6:  Frontend integration
Day 7:    E2E test: generate + upload + fetch prekeys
```

### Этап 2: Message Encryption (1-2 недели)

```
Day 1-2:  Per-message key derivation (HKDF)
Day 3:    AES-256-GCM message encryption
Day 4-5:  Tests
Day 6-7:  1:1 chat E2E test
```

### Этап 3: Group Chats (2-3 недели)

```
НЕДЕЛЯ 1:
─────────
Day 1-2:  Group key exchange (Simple Fanout)
Day 3-4:  Per-participant key derivation
Day 5-7:  Tests

НЕДЕЛЯ 2:
─────────
Day 1:    Database schema (group_chat_info, group_members)
Day 2-3:  Backend GroupChatService
Day 4-5:  API endpoints
Day 6-7:  Tests

НЕДЕЛЯ 3:
─────────
Day 1-2:  Frontend group message send/receive
Day 3-4:  Message routing (server fan-out)
Day 5-7:  E2E tests + UI integration
```

---

## 8. Checklist: Pre-implementation

### Перед началом разработки

- [ ] Обновить E2EE_ENCRYPTION_SYSTEM_v2.md (уточнить Curve25519)
- [ ] Добавить @noble/curves в dependencies (frontend & backend)
- [ ] Добавить @noble/hashes/hkdf (уже есть @noble/hashes)
- [ ] Создать crypto/core/x3dh.ts (frontend)
- [ ] Создать crypto/core/hkdf.ts (frontend)
- [ ] Создать crypto/prekey-manager.ts (frontend)
- [ ] Создать backend crypto domain structure
- [ ] Создать database migrations для:
  - `handle_prekeys`
  - `used_otkeys`
  - `group_chat_info`
  - `group_members`
  - `chat_message_counters`
- [ ] Code review E2EE_ENCRYPTION_SYSTEM_v2.md with team

---

## 9. Выводы

### ✅ Что хорошо в v2

1. **Архитектура правильная:** X3DH + Double Ratchet + Simple Fanout
2. **Security model solid:** hPK в памяти, pre-keys шифрованы, OTK one-time
3. **UX good:** Lazy activation делает self-custody практичным
4. **Scalability OK:** Simple Fanout работает до 100 участников

### ⚠️ Что нужно уточнить в v2

1. **Curve25519 явно указать:** Вместо абстрактного "ECDH"
2. **HKDF формально описать:** IKM, salt, info, length
3. **Message counter strategy:** Per-sender counters
4. **GroupSecret derivation:** HKDF вместо SHA256

### 🔴 Критические пробелы в коде

1. **Нет HKDF** ← Нужно добавить
2. **Нет X3DH** ← Нужно добавить
3. **Нет Pre-keys API** ← Нужно добавить
4. **Нет Group Chat Service** ← Нужно добавить
5. **Нет database migrations** ← Нужно добавить

### 📅 Рекомендуемый timeline

- **Неделя 1-2:** X3DH + HKDF infrastructure
- **Неделя 3:** Message encryption (1:1)
- **Неделя 4-5:** Group chats (Simple Fanout)
- **Неделя 6:** Testing & security audit

**Total: ~6 недель на full implementation**

---

**Статус:** 🟢 ГОТОВ К РЕАЛИЗАЦИИ с указанными уточнениями
