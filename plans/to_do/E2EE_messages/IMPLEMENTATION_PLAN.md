# 🚀 Implementation Plan: E2EE_ENCRYPTION_SYSTEM v2 with Group Chats

**Статус:** Ready for Phase 3 (X3DH + Group Chats)  
**Версия:** 1.0  
**Дата:** 2026-02-17

---

## Executive Summary

Документация **E2EE_ENCRYPTION_SYSTEM_v2.md** готова к реализации с 2 уточнениями:

1. ✅ **Архитектура правильная:** X3DH для 1:1 + Simple Fanout для групп
2. ⚠️ **Уточнение 1:** Явно указать Curve25519 для ECDH операций
3. ⚠️ **Уточнение 2:** HKDF формально описать для group key exchange

**Текущее состояние кода:**
- ✅ 80% основной криптографии есть (Ed25519, Argon2id, AES-256-GCM, PBKDF2)
- ❌ 0% X3DH реализовано
- ❌ 0% Group chats реализовано
- ❌ 0% Pre-keys management реализовано

**Требуемые пакеты:** `@noble/curves` (не установлен)

---

## Part 1: Обновления E2EE_ENCRYPTION_SYSTEM_v2.md

### Обновление 1.1: Curve25519 для ECDH (CRITICAL)

**Где обновить:** Раздел 5.1 "Структура ключей участников"

**Текущий текст:**
```markdown
### 5.1 Структура ключей участников

**Alice (Отправитель):**
- `IK_A` (Identity Key — долгоживущий)
- `EK_A` (Ephemeral Key — один раз для этого чата)

**Bob (Получатель):**
- `IK_B` (Identity Key — долгоживущий)
- `SPK_B` (Signed Pre-Key — живет 30 дней)
- `OTK_B` (One-Time Key — потребляется один раз)
```

**НОВЫЙ ТЕКСТ:**
```markdown
### 5.1 Структура ключей участников (ОБНОВЛЕНО)

**Криптографические схемы:**
- **Идентификация:** Ed25519 (долгоживущие ключи, подписи)
- **Diffie-Hellman (DH):** Curve25519 / X25519 (session keys, ephemeral)

**Alice (Отправитель):**
- `IK_A` (Identity Key — Ed25519, долгоживущий, для подписей)
- `EK_A` (Ephemeral Key — Curve25519, один раз для этого чата, для DH)

**Bob (Получатель):**
- `IK_B` (Identity Key — Ed25519, долгоживущий, для верификации)
- `SPK_B` (Signed Pre-Key — Curve25519 public, живет 30 дней)
  - Подписана `IK_B.sk` (Ed25519 signature)
- `OTK_B` (One-Time Key — Curve25519 public, потребляется один раз)

**X3DH Operand:**
```
DH1 = X25519(IK_A.scalar, SPK_B.public) → 32 bytes
DH2 = X25519(EK_A.scalar, IK_B.public) → 32 bytes
DH3 = X25519(EK_A.scalar, SPK_B.public) → 32 bytes
DH4 = X25519(IK_A.scalar, OTK_B.public) → 32 bytes
───────────────────────────────────────────────────
Total IKM = 128 bytes

CK = HKDF-SHA256(IKM, salt=null, info="BeChat.X3DH.v1", length=32) → 32 bytes
```
```

### Обновление 1.2: HKDF для Group Key Exchange (CRITICAL)

**Где обновить:** Раздел 4.2 "Групповой чат"

**Текущий текст:**
```typescript
groupSecret = SHA-256(random(32) || timestamp || groupId)
participantKey_i = HKDF(groupSecret, salt=participantId, info="group_participant")
```

**НОВЫЙ ТЕКСТ:**
```typescript
// Group Key Exchange (Simple Fanout - v2)

// Step 1: Generate group secret with entropy
groupSecret = HKDF-SHA256(
  IKM = random(32),
  salt = "BeChat.GroupSecret.v1" (as bytes),
  info = groupId (as bytes),
  length = 32
) → 32 bytes

// Step 2: Derive participant key for each member
participantKey_i = HKDF-SHA256(
  IKM = groupSecret,
  salt = null,
  info = participantId + ":participant" (as bytes),
  length = 32
) → 32 bytes

// Step 3: Per-message derivation
messageKey_i = HKDF-SHA256(
  IKM = participantKey_i,
  salt = null,
  info = messageNumber.toString() + ":message" (as bytes),
  length = 32
) → 32 bytes
```

### Обновление 1.3: Message Counter Strategy (IMPORTANT)

**Где обновить:** Раздел 7.1 "Структура данных в IndexedDB"

**Добавить пояснение:**
```markdown
**Important: Per-sender counters**

Message counter должен быть **per-sender**, не глобальный:

```typescript
messageCounterPerSender: {
  [senderId]: number  // Каждый sender имеет свой счётчик
}
```

Это гарантирует:
- ✅ Параллельные сообщения от разных users не конфликтуют
- ✅ Каждая пара (senderId, messageNumber) уникальна в чате
- ✅ Разные users используют разные derivation keys

Пример:
```
Alice sends message #1 → messageKey = HKDF(..., info="1:alice:message")
Bob sends message #1 simultaneously → messageKey = HKDF(..., info="1:bob:message")
→ Разные ключи! ✅
```
```

---

## Part 2: Code Implementation Checklist

### Phase 1: Dependencies & Setup (Day 1)

- [ ] Add `@noble/curves` to frontend/package.json and backend/package.json
- [ ] Run `npm install` / `pnpm install`
- [ ] Verify `@noble/hashes` has HKDF support (already installed)
- [ ] Create new directories:
  - `frontend/app/lib/crypto/protocols/` (for X3DH)
  - `backend/src/domains/crypto/` (for services)

### Phase 2: HKDF Utility (Day 2)

**File:** `frontend/app/lib/crypto/core/hkdf.ts`

```typescript
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

export async function deriveKeyWithHKDF(
  ikm: Uint8Array,           // Input key material
  salt: Uint8Array | null,   // Salt (optional)
  info: Uint8Array | string, // Context info
  length: number = 32        // Output length
): Promise<Uint8Array> {
  const infoBytes = typeof info === 'string' 
    ? new TextEncoder().encode(info)
    : info;
  
  return hkdf(sha256, ikm, salt, infoBytes, length);
}

// Helper: derive participant key for groups
export async function deriveParticipantKey(
  groupSecret: Uint8Array,
  participantId: string
): Promise<Uint8Array> {
  const info = `${participantId}:participant`;
  return deriveKeyWithHKDF(groupSecret, null, info, 32);
}

// Helper: derive per-message key
export async function deriveMessageKey(
  participantKey: Uint8Array,
  messageNumber: number
): Promise<Uint8Array> {
  const info = `${messageNumber}:message`;
  return deriveKeyWithHKDF(participantKey, null, info, 32);
}
```

**Tests:** `frontend/app/lib/crypto/core/hkdf.spec.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { deriveKeyWithHKDF, deriveParticipantKey, deriveMessageKey } from './hkdf';

describe('HKDF', () => {
  it('derives keys deterministically', async () => {
    const ikm = new Uint8Array(32);
    const info = 'test';
    
    const key1 = await deriveKeyWithHKDF(ikm, null, info, 32);
    const key2 = await deriveKeyWithHKDF(ikm, null, info, 32);
    
    expect(key1).toEqual(key2); // Deterministic ✓
  });

  it('participant keys are different for different participants', async () => {
    const groupSecret = new Uint8Array(32);
    
    const keyA = await deriveParticipantKey(groupSecret, 'alice-id');
    const keyB = await deriveParticipantKey(groupSecret, 'bob-id');
    
    expect(keyA).not.toEqual(keyB); // Different keys ✓
  });

  it('message keys are different for different message numbers', async () => {
    const participantKey = new Uint8Array(32);
    
    const msgKey1 = await deriveMessageKey(participantKey, 1);
    const msgKey2 = await deriveMessageKey(participantKey, 2);
    
    expect(msgKey1).not.toEqual(msgKey2); // Different keys ✓
  });
});
```

### Phase 3: X3DH Protocol (Day 3-5)

**File:** `frontend/app/lib/crypto/protocols/x3dh.ts`

```typescript
import { x25519, x25519Public } from '@noble/curves/x25519';
import { randomBytes } from '../utils/binary';
import { deriveKeyWithHKDF } from '../core/hkdf';
import { concatUint8Arrays } from '../utils/binary';

export interface X3DHPreKeys {
  ikPk: Uint8Array;      // Identity key public (32 bytes)
  spkPk: Uint8Array;     // Signed pre-key public (32 bytes)
  spkSig: Uint8Array;    // SPK signature (64 bytes, Ed25519)
  otkPks: Uint8Array[];  // One-time key publics (array of 32-byte values)
}

export interface X3DHResult {
  chatKey: Uint8Array;              // 32 bytes, ready for encryption
  ephemeralPublicKey: Uint8Array;   // 32 bytes, send to recipient
  selectedOtkIndex: number;         // Which OTK was used
}

/**
 * Perform X3DH key exchange (Alice's side - initiator)
 * Alice knows Bob's pre-keys and computes shared secret
 */
export async function performX3DH(
  aliceIkSk: Uint8Array,        // Alice's identity private key (32 bytes, Curve25519 scalar)
  bobPreKeys: X3DHPreKeys,       // Bob's pre-keys
  otkIndex: number               // Which OTK to use (0-99)
): Promise<X3DHResult> {
  // Validate inputs
  if (!bobPreKeys.otkPks[otkIndex]) {
    throw new Error(`Invalid OTK index: ${otkIndex}`);
  }

  // 1. Generate ephemeral key pair
  const ekSk = x25519.utils.randomPrivateKey();
  const ekPk = x25519Public(ekSk);

  // 2. Perform 4 Diffie-Hellman operations
  const dh1 = x25519(aliceIkSk, bobPreKeys.spkPk);        // IK_A → SPK_B
  const dh2 = x25519(ekSk, bobPreKeys.ikPk);             // EK_A → IK_B
  const dh3 = x25519(ekSk, bobPreKeys.spkPk);            // EK_A → SPK_B
  const dh4 = x25519(aliceIkSk, bobPreKeys.otkPks[otkIndex]); // IK_A → OTK_B

  // 3. Concatenate all DH results
  const ikm = concatUint8Arrays([dh1, dh2, dh3, dh4]);

  // 4. Derive chat key using HKDF
  const chatKey = await deriveKeyWithHKDF(
    ikm,
    null,
    "BeChat.X3DH.v1",
    32
  );

  return {
    chatKey,
    ephemeralPublicKey: ekPk,
    selectedOtkIndex: otkIndex
  };
}

/**
 * Complete X3DH key exchange (Bob's side - responder)
 * Bob has ephemeral key from Alice and computes same shared secret
 * This is for validation and testing - in practice Bob computes CK when receiving message
 */
export async function completeX3DH(
  bobIkSk: Uint8Array,              // Bob's identity private key
  bobSpkSk: Uint8Array,             // Bob's signed pre-key private
  bobOtkSk: Uint8Array,             // Bob's one-time key private (the one Alice used)
  aliceEkPk: Uint8Array,            // Alice's ephemeral public
  aliceIkPk: Uint8Array             // Alice's identity public
): Promise<Uint8Array> {
  // Perform 4 DH operations (Bob's perspective)
  const dh1 = x25519(bobSpkSk, aliceIkPk);      // SPK_B → IK_A
  const dh2 = x25519(bobIkSk, aliceEkPk);      // IK_B → EK_A
  const dh3 = x25519(bobSpkSk, aliceEkPk);     // SPK_B → EK_A
  const dh4 = x25519(bobOtkSk, aliceIkPk);     // OTK_B → IK_A

  const ikm = concatUint8Arrays([dh1, dh2, dh3, dh4]);

  // Same HKDF as Alice's side = same CK ✓
  return deriveKeyWithHKDF(ikm, null, "BeChat.X3DH.v1", 32);
}
```

**Tests:** `frontend/app/lib/crypto/protocols/x3dh.spec.ts`
```typescript
import { describe, it, expect } from 'vitest';
import { performX3DH, completeX3DH } from './x3dh';
import { x25519Public } from '@noble/curves/x25519';

describe('X3DH Protocol', () => {
  it('should produce same chat key on both sides', async () => {
    // Setup: Generate test keys
    const aliceIkSk = /* generate */;
    const aliceIkPk = x25519Public(aliceIkSk);
    
    const bobIkSk = /* generate */;
    const bobIkPk = x25519Public(bobIkSk);
    
    const bobSpkSk = /* generate */;
    const bobSpkPk = x25519Public(bobSpkSk);
    
    const bobOtkSk = /* generate */;
    const bobOtkPk = x25519Public(bobOtkSk);

    // Alice side: initiate X3DH
    const aliceResult = await performX3DH(
      aliceIkSk,
      {
        ikPk: bobIkPk,
        spkPk: bobSpkPk,
        spkSig: /* dummy */,
        otkPks: [bobOtkPk]
      },
      0  // Use first OTK
    );

    // Bob side: complete X3DH
    const bobCK = await completeX3DH(
      bobIkSk,
      bobSpkSk,
      bobOtkSk,
      aliceResult.ephemeralPublicKey,
      aliceIkPk
    );

    // Same chat key! ✓
    expect(aliceResult.chatKey).toEqual(bobCK);
  });
});
```

### Phase 4: Pre-key Manager (Day 6-7)

**File:** `frontend/app/lib/crypto/managers/prekey-manager.ts`

```typescript
import { x25519, x25519Public } from '@noble/curves/x25519';
import { ed25519 } from '@noble/ed25519';
import { randomBytes } from '../utils/binary';
import { encryptWithKey, decryptWithKey } from '../core/encryption';
import { deriveEncryptionKeyFromHash } from '../core/key-derivation';
import { signMessage } from '../core/signatures';
import { concatUint8Arrays } from '../utils/binary';

export interface StoredPreKeys {
  spkPk: Uint8Array;
  spkSkEncrypted: Uint8Array;
  spkSkIv: Uint8Array;
  spkSig: Uint8Array;
  otkPks: Uint8Array[];
  otkSksEncrypted: Uint8Array;
  otkSksIv: Uint8Array;
  createdAt: number;
  expiresAt: number;
}

export async function generateAndStorePreKeys(
  hPK: Uint8Array,
  ikSk: Uint8Array,      // Identity key private (for signing SPK)
  handleId: string,
  db: any                // IndexedDB instance
): Promise<{ spkPk: Uint8Array; spkSig: Uint8Array; otkPks: Uint8Array[] }> {
  // 1. Generate Signed Pre-Key (SPK)
  const spkSk = x25519.utils.randomPrivateKey();
  const spkPk = x25519Public(spkSk);
  
  // Sign SPK with identity key
  const spkSig = await signMessage(ikSk, spkPk);

  // 2. Generate 100 One-Time Keys (OTK)
  const otkSks: Uint8Array[] = [];
  const otkPks: Uint8Array[] = [];
  
  for (let i = 0; i < 100; i++) {
    const sk = x25519.utils.randomPrivateKey();
    otkSks.push(sk);
    otkPks.push(x25519Public(sk));
  }

  // 3. Encrypt SPK.sk under hPK
  const spkEncKey = await deriveEncryptionKeyFromHash(hPK, handleId, 'spk');
  const { encrypted: spkSkEncrypted, iv: spkSkIv } = await encryptWithKey(
    spkSk,
    spkEncKey
  );

  // 4. Encrypt all OTK.sks under hPK
  const otkEncKey = await deriveEncryptionKeyFromHash(hPK, handleId, 'otk');
  const otkSksConcat = concatUint8Arrays(otkSks);
  const { encrypted: otkSksEncrypted, iv: otkSksIv } = await encryptWithKey(
    otkSksConcat,
    otkEncKey
  );

  // 5. Store in IndexedDB
  const now = Date.now();
  const prekeys: StoredPreKeys = {
    spkPk,
    spkSkEncrypted,
    spkSkIv,
    spkSig,
    otkPks,
    otkSksEncrypted,
    otkSksIv,
    createdAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000  // 30 days
  };

  await db.sessionPreKeys.put(prekeys);

  return { spkPk, spkSig, otkPks };
}

export async function getStoredPreKeys(db: any): Promise<StoredPreKeys | null> {
  return db.sessionPreKeys.toCollection().first();
}

export async function decryptStoredSPK(
  stored: StoredPreKeys,
  hPK: Uint8Array,
  handleId: string
): Promise<Uint8Array> {
  const spkEncKey = await deriveEncryptionKeyFromHash(hPK, handleId, 'spk');
  return decryptWithKey(stored.spkSkEncrypted, spkEncKey, stored.spkSkIv);
}

export async function decryptStoredOTKs(
  stored: StoredPreKeys,
  hPK: Uint8Array,
  handleId: string
): Promise<Uint8Array[]> {
  const otkEncKey = await deriveEncryptionKeyFromHash(hPK, handleId, 'otk');
  const decrypted = await decryptWithKey(
    stored.otkSksEncrypted,
    otkEncKey,
    stored.otkSksIv
  );

  // Split back into individual OTK.sks (32 bytes each)
  const result: Uint8Array[] = [];
  for (let i = 0; i < decrypted.length; i += 32) {
    result.push(decrypted.slice(i, i + 32));
  }

  return result;
}
```

### Phase 5: Backend Pre-keys API (Day 8-10)

**File:** `backend/src/domains/crypto/dtos/upload-prekeys.dto.ts`

```typescript
import { IsBase64, IsNotEmpty, IsArray } from 'class-validator';

export class UploadPreKeysDto {
  @IsNotEmpty()
  @IsBase64()
  spkPk!: string;  // Base64-encoded public key (32 bytes)

  @IsNotEmpty()
  @IsBase64()
  spkSignature!: string;  // Base64-encoded signature (64 bytes)

  @IsArray()
  @IsBase64({ each: true })
  otkPks!: string[];  // Array of base64-encoded public keys
}
```

**File:** `backend/src/domains/crypto/controllers/prekeys.controller.ts`

```typescript
import { Controller, Post, Get, Param, Body } from '@nestjs/common';
import { PrekeysService } from '../services/prekeys.service';
import { UploadPreKeysDto } from '../dtos/upload-prekeys.dto';
import { CurrentUser } from '../../session/decorators/current-user.decorator';
import { User } from '../../profile/entities/user.entity';

@Controller('crypto/prekeys')
export class PrekeysController {
  constructor(private readonly prekeysService: PrekeysService) {}

  @Post('upload')
  async uploadPreKeys(
    @CurrentUser() user: User,
    @Body() dto: UploadPreKeysDto
  ) {
    return this.prekeysService.storePreKeys(user.id, dto);
  }

  @Get(':handleId')
  async getPreKeys(@Param('handleId') handleId: string) {
    return this.prekeysService.getPreKeys(handleId);
  }

  @Post('rotate')
  async rotatePreKeys(@CurrentUser() user: User) {
    return this.prekeysService.rotatePreKeys(user.id);
  }
}
```

**File:** `backend/src/domains/crypto/services/prekeys.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HandlePreKey } from '../entities/handle-prekey.entity';
import { UploadPreKeysDto } from '../dtos/upload-prekeys.dto';

@Injectable()
export class PrekeysService {
  constructor(
    @InjectRepository(HandlePreKey)
    private readonly preKeysRepository: Repository<HandlePreKey>
  ) {}

  async storePreKeys(
    userId: string,
    dto: UploadPreKeysDto
  ): Promise<HandlePreKey> {
    // TODO: Get user's current handle
    const handleId = user.currentHandle.id;

    // Save to DB
    return this.preKeysRepository.save({
      handleId,
      spkPk: Buffer.from(dto.spkPk, 'base64'),
      spkSignature: Buffer.from(dto.spkSignature, 'base64'),
      otkPks: dto.otkPks.map(pk => Buffer.from(pk, 'base64')),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
  }

  async getPreKeys(handleId: string): Promise<any> {
    const prekeys = await this.preKeysRepository.findOne({
      where: { handleId },
      order: { createdAt: 'DESC' }
    });

    if (!prekeys || prekeys.expiresAt < new Date()) {
      throw new Error('Pre-keys not available or expired');
    }

    return {
      spkPk: prekeys.spkPk.toString('base64'),
      spkSignature: prekeys.spkSignature.toString('base64'),
      otkPks: prekeys.otkPks.map(pk => pk.toString('base64'))
    };
  }

  async rotatePreKeys(userId: string): Promise<void> {
    // Mark old prekeys as expired
    // Trigger client to generate new ones
  }
}
```

### Phase 6: Group Chat Infrastructure (Day 11-15)

**Similar structure for:**
- `GroupChatService` (backend)
- `GroupKeyExchangeService` (frontend)
- Database migrations for `group_chat_info`, `group_members`, etc.

**Details in E2EE_ENCRYPTION_SYSTEM_v2.md sections 9-11**

---

## Part 3: Database Migrations

### Migration 1: Pre-keys Tables

**File:** `backend/src/db/migrations/001-create-prekeys-tables.sql`

```sql
-- Handle pre-keys (публичные ключи на сервере)
CREATE TABLE handle_prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_id UUID NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  spk_pk BYTEA NOT NULL,        -- SPK public key (32 bytes)
  spk_signature BYTEA NOT NULL, -- Ed25519 signature (64 bytes)
  otk_pks BYTEA[] NOT NULL,     -- Array of OTK public keys
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(handle_id, created_at)
);

-- Track OTK usage
CREATE TABLE used_otkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_id UUID NOT NULL REFERENCES handles(id) ON DELETE CASCADE,
  otk_pk BYTEA NOT NULL,
  used_by_sender_id UUID NOT NULL REFERENCES identities(id),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(otk_pk, used_by_sender_id)
);

-- Per-chat message counters (для tracking sent messages)
CREATE TABLE chat_message_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES identities(id),
  message_counter INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(chat_id, sender_id)
);

CREATE INDEX idx_handle_prekeys_expires ON handle_prekeys(expires_at);
CREATE INDEX idx_used_otkeys_handle ON used_otkeys(handle_id);
CREATE INDEX idx_message_counters_chat ON chat_message_counters(chat_id);
```

### Migration 2: Group Chat Tables

```sql
-- Group chat metadata
CREATE TABLE group_chat_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL REFERENCES identities(id),
  group_name VARCHAR(255),
  description TEXT,
  max_members INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_rekey_at TIMESTAMP
);

-- Group members
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id UUID NOT NULL REFERENCES group_chat_info(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  role VARCHAR(50) DEFAULT 'member',
  UNIQUE(group_chat_id, member_id)
);

CREATE INDEX idx_group_members_chat ON group_members(group_chat_id);
CREATE INDEX idx_group_members_member ON group_members(member_id);
```

---

## Part 4: Testing Strategy

### Unit Tests (40% time)
- [ ] HKDF derivation (deterministic, different for different inputs)
- [ ] X3DH protocol (symmetric keys on both sides)
- [ ] Pre-key generation and encryption
- [ ] Group key exchange (per-participant derivation)

### Integration Tests (30% time)
- [ ] 1:1 chat: Generate pre-keys → Upload → Fetch → X3DH → Encrypt/Decrypt
- [ ] Group chat: Create → Add member → Send message → Receive & decrypt
- [ ] Edge cases: OTK exhaustion, SPK rotation, stale prekeys

### E2E Tests (20% time)
- [ ] Two clients establish 1:1 chat and exchange messages
- [ ] Multiple clients join group and exchange messages
- [ ] Message ordering with per-sender counters
- [ ] Lazy seed activation (30 days cache)

### Security Tests (10% time)
- [ ] Verify OTK cannot be reused
- [ ] Verify hPK not leaked to storage
- [ ] Verify forward secrecy (old message key derivation fails)
- [ ] Verify group member removal (old secret doesn't decrypt new messages)

---

## Part 5: Timeline & Milestones

### Week 1: Foundation
- **Days 1-2:** Update E2EE_ENCRYPTION_SYSTEM_v2.md with corrections
- **Days 3-5:** HKDF + X3DH implementation
- **Days 6-7:** X3DH tests + code review
- **Deliverable:** X3DH protocol working end-to-end

### Week 2: 1:1 Chat Encryption
- **Days 1-2:** Pre-key manager (generate + store)
- **Days 3-4:** Backend pre-keys API + database
- **Days 5-6:** Per-message encryption (HKDF + AES-256-GCM)
- **Days 7:** Integration tests
- **Deliverable:** 1:1 chats fully encrypted

### Week 3: Group Chats
- **Days 1-2:** Group key exchange (Simple Fanout)
- **Days 3-4:** Backend group chat service + API
- **Days 5-6:** Frontend group message send/receive
- **Day 7:** Basic group tests
- **Deliverable:** Group chats working (Simple Fanout)

### Week 4: Polish & Security
- **Days 1-2:** Performance optimization (message routing)
- **Days 3-4:** Security hardening (OTK tracking, rekeying)
- **Days 5-6:** Comprehensive testing
- **Day 7:** Security audit preparation
- **Deliverable:** Production-ready code

### Week 5: (Optional) UI Integration
- **Create UI for group chat creation**
- **Add member management UI**
- **Display encryption status**

---

## Part 6: Risk Assessment

### HIGH RISK 🔴
1. **Curve25519 not available in Web Crypto:** @noble/curves required
   - **Mitigation:** Already planned, use @noble/curves/x25519
2. **Message counter collision in groups:** Needs per-sender tracking
   - **Mitigation:** Already in v2.md, implement strictly

### MEDIUM RISK 🟠
1. **Performance with 100 participants:** Simple Fanout = N ciphertexts
   - **Mitigation:** Start with 100, optimize later
2. **Rekeying complexity when member leaves:** Needs careful state management
   - **Mitigation:** For v2, do full group secret regeneration (simpler)

### LOW RISK 🟢
1. **Crypto library bugs:** Using well-tested @noble/* packages
2. **XSS leaking hPK:** Mitigation already in place (memory-only)

---

## Part 7: Success Criteria

### Phase 3 Complete When:
- ✅ X3DH protocol tests pass (same CK on both sides)
- ✅ 1:1 chat messages encrypted/decrypted correctly
- ✅ Pre-keys generated, stored, and rotated
- ✅ Group chats created and messages distributed
- ✅ Message counters per-sender (no collisions)
- ✅ All HKDF derivations deterministic and unique
- ✅ Code reviewed by 2+ developers
- ✅ Security audit passed

### Before Production:
- ✅ 90%+ code coverage for crypto modules
- ✅ All unit + integration tests passing
- ✅ E2E test: 2 clients exchange encrypted messages
- ✅ E2E test: 5 clients exchange group messages
- ✅ Security audit from external firm (recommended)

---

## Conclusion

**Status:** 🟢 **READY TO START IMPLEMENTATION**

**Next steps:**
1. Approve E2EE_ENCRYPTION_SYSTEM_v2.md with corrections
2. Install @noble/curves to both frontend and backend
3. Create feature branch: `feature/x3dh-group-chats`
4. Begin Phase 1: Dependencies & Setup
5. Follow the detailed checklist above

**Estimated effort:** 4-5 weeks for full implementation
**Team:** 2-3 engineers (1 for frontend, 1 for backend, 1 for testing)

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-17  
**Status:** Ready for Implementation ✅
