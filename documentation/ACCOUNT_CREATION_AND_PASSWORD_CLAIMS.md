# Account Creation and Password Claims Solution

**Document Version:** 1.0  
**Last Updated:** February 2, 2026  
**Status:** Code-verified and complete

---

## Overview

This document details BeSafeChat's account creation workflows and password uniqueness protection system.

---

## Account Creation Flow

### Cloud Backup Method (10 Steps)

```
1. User selects Cloud Backup
2. System validates password strength
3. Check password uniqueness
4. Generate BIP39 12-word seed phrase
5. Derive Ed25519 key pair from seed
6. Challenge-response login (creates identity if first time)
7. Initialize IndexedDB with identityId
8. Destroy private key (overwrite + clear)
9. Encrypt seed with password (Argon2id + AES-256-GCM)
10. Upload to S3 and download backup file
```

### Self-Custody Method (5 Steps)

```
1. User selects Self-Custody
2. Generate and display BIP39 seed
3. User verifies seed by selecting words
4. Derive Ed25519 key pair
5. Challenge-response login (creates identity if first time)
6. Initialize IndexedDB
7. Destroy private key
   (No cloud upload - user stores seed)
```

---

## Default Identity Creation

On first login with new public key:

```
1. IdentityService.registerIdentity(publicKey)
   └─ Creates Identity with masterPublicKey

2. AuthService.generateHandleFromPublicKey(publicKey)
   └─ Format: user_{SHA256(publicKey)[0:12]}

3. HandleService.createHandle()
   └─ value: generated handle
   └─ type: 'account'
   └─ isPrimary: true
   └─ isSearchable: true

4. ProfileService.createProfile()
   └─ displayName: "Anonym User"
   └─ handleId: primary handle

5. SessionService.createSession()
   └─ Create access + refresh tokens
   └─ Set device info
```

**Result:**
- ✅ Identity created
- ✅ Default handle assigned
- ✅ Default profile created
- ✅ Session established
- ✅ User logged in

---

## Password Claims Architecture

### Current Implementation (PostgreSQL)

**Table: claimed_recovery_passwords**
```sql
password_hash TEXT PRIMARY KEY
claimed_at TIMESTAMPTZ
```

**Flow:**
1. Check availability: Query table
2. Claim password: INSERT with UNIQUE constraint
3. Store indefinitely: No expiration
4. Database bloat: Table grows over time

**Problems:**
❌ No automatic cleanup
❌ Permanent storage
❌ Query overhead
❌ Database size growth

### Proposed Solution (Redis)

**Key Structure:**
```
Key: password:claim:{hash}
Value: "1"
TTL: 24 hours (automatic expiration)
```

**Operations:**
```typescript
// Check availability (O(1))
async isPasswordAvailable(hash: string): Promise<boolean>
  → redis.exists(key) === 0

// Claim password (atomic)
async claimPassword(hash: string): Promise<boolean>
  → redis.set(key, "1", "EX", 86400, "NX")

// Auto-cleanup
  → Redis TTL handles automatic deletion
```

**Benefits:**
✅ Automatic expiration (24 hours)
✅ O(1) performance
✅ No database load
✅ Self-cleaning (no cleanup jobs)
✅ Atomic operations (SET NX)

---

## Account Recovery

### Password Recovery (7 Steps)

```
1. User enters password from creation
2. Client computes storage path (Argon2id, deterministic)
3. Download encrypted seed from S3
4. Decrypt with password
5. Derive Ed25519 key pair from seed
6. Challenge-response login
7. Session established
```

### Seed Recovery (5 Steps)

```
1. User provides 12-word seed phrase
2. Validate BIP39 format
3. Derive Ed25519 key pair
4. Challenge-response login
5. Session established
```

---

## Implementation Details

### Frontend (AccountService)

```typescript
// Cloud backup creation
createAccountWithCloud(password: string)
  1. Validate password strength
  2. Check password uniqueness (POST /password-recovery/check-availability)
  3. Generate seed → derive keys
  4. Challenge-response login
  5. Initialize database
  6. Destroy private key
  7. Claim password (POST /password-recovery/claim)
  8. Encrypt seed
  9. Upload to cloud

// Self-custody creation
createAccountWithSelfCustody()
  1. Generate seed → derive keys
  2. Challenge-response login
  3. Initialize database
  4. Destroy private key
  (No cloud operations)

// Password recovery
recoverWithPassword(password: string)
  1. Compute storage path (Argon2id)
  2. Download encrypted seed from S3
  3. Decrypt with password
  4. Derive keys
  5. Destroy original key
  6. Return for login

// Seed recovery
recoverWithSeed(seed: string[])
  1. Validate seed
  2. Derive keys
  3. Destroy original key
  4. Return for login
```

### Backend (PasswordRecoveryService)

```typescript
// Check availability
async isPasswordHashAvailable(hash: string): Promise<boolean>
  → Query claimed_recovery_passwords table

// Claim password
async claimPasswordHash(hash: string): Promise<ClaimResult>
  → INSERT into claimed_recovery_passwords
  → Catch UNIQUE constraint violation (409)
  → Return success/already_claimed

// Rate limiting
@UseGuards(RecoveryRateLimitGuard)
  → Per-IP request limiting
  → Timing attack protection (50-150ms delay)
```

---

## Security Features

### Password Hashing
- Client: SHA-256 hash
- Server: Never sees plaintext
- Both: Hash-based uniqueness check

### Storage Path Derivation
- Algorithm: Argon2id
- Public salt: Fixed (in code)
- Iterations: 3
- Memory: 65536 KB
- Deterministic: Same password → same path

### Seed Encryption
- Algorithm: AES-256-GCM
- Key derivation: PBKDF2 (password-based)
- Salt: Random per seed
- IV: Random per seed
- Authentication tag: Prevents tampering

### Rate Limiting
- Per-IP limiting on auth endpoints
- Challenge attempt limiting (5 max)
- Random delay: 50-150ms (timing attack protection)
- Exponential backoff: 2s, 4s, 8s (retry)

---

## Redis Migration Path

### Phase 1: Preparation
- Create RedisPasswordClaimService
- Implement dual-write logic
- All new claims go to both PostgreSQL and Redis

### Phase 2: Validation (24 hours)
- Monitor logs for consistency
- Verify Redis operations work
- Test all scenarios

### Phase 3: Cutover
- Switch reads to Redis only
- Remove dual-write
- Verify all operations succeed

### Phase 4: Cleanup
- Archive PostgreSQL data
- Drop claimed_recovery_passwords table
- Update documentation

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/password-recovery/check-availability` | POST | Check if password available |
| `/password-recovery/claim` | POST | Claim password for exclusive use |

**Request Examples:**

Check Availability:
```json
POST /password-recovery/check-availability
{
  "password_hash": "sha256_hex_string"
}
```

Claim Password:
```json
POST /password-recovery/claim
{
  "password_hash": "sha256_hex_string",
  "user_agent": "Mozilla/5.0..."
}
```

**Response Examples:**

Success (200):
```json
{
  "success": true,
  "message": "Password claimed successfully"
}
```

Conflict (409):
```json
{
  "statusCode": 409,
  "message": "Password already claimed by another user",
  "code": "PASSWORD_CLAIMED"
}
```

---

## Comparison

| Feature | PostgreSQL | Redis |
|---------|-----------|-------|
| Performance | O(log n) | O(1) |
| Expiration | Manual | Automatic |
| Database Load | Yes | No |
| Cleanup | Cron job | Self-cleaning |
| Atomicity | DB constraint | SET NX |
| Scalability | Issues at scale | Highly scalable |
| Implementation | Done | 4-phase plan |

---

_Last Updated: February 2, 2026_
