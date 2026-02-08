# BeSafe Chat Authentication System Analysis

**Document Version:** 2.0  
**Last Updated:** February 2, 2026  
**Status:** Code-verified and complete

---

## Overview

BeSafeChat implements a sophisticated public-key cryptography-based authentication system using Ed25519 keys combined with challenge-response mechanisms. The system prioritizes privacy, security, and anonymity by using cryptographic key pairs as the primary identity mechanism.

**Core Innovation:** Users are identified by Ed25519 public keys rather than usernames or passwords. Private keys are ephemeral—destroyed immediately after authentication and never stored.

---

## Authentication Architecture

### Backend Components

**AuthSessionController** - 10 Endpoints
- `/auth/login/challenge` - Request challenge
- `/auth/login` - Submit signed challenge
- `/auth/dev-login` - Dev-only login
- `/auth/profile` - Get current profile
- `/auth/sessions` - List active sessions
- `/auth/sessions/revoke/:id` - Revoke session
- `/auth/sessions/revoke-all` - Revoke all others
- `/auth/switch-handle` - Switch active handle
- `/auth/logout` - Logout
- `/auth/refresh` - Refresh tokens

**AuthService** - Core Logic
- `loginWithPublicKey()` - Challenge response flow
- `generateHandleFromPublicKey()` - Default handle generation
- `getIdentityProfile()` - Profile retrieval
- `refreshTokens()` - Token refresh

**ChallengeService** - Challenge Management
- `createChallenge()` - Generate 256-bit random challenge
- `validateChallenge()` - Verify signature
- `verifySignature()` - Ed25519 verification

**IdentityService** - Identity Management
- `registerIdentity()` - Create identity from public key
- `findByIdentityPublicKey()` - Look up identity

**SessionService** - Session & Token Management
- `createSession()` - Create new session (max 5 per identity)
- `validateAccessToken()` - Hash and verify token
- `refreshSession()` - Issue new tokens
- `switchActiveHandle()` - Change active handle

**HandleService** - Username Management
- `createHandle()` - Create new handle
- `getPrimaryHandle()` - Get primary handle
- `searchHandles()` - Search by value

**ProfileService** - Display Information
- `createProfile()` - Create profile for handle
- `getProfileByHandle()` - Retrieve profile
- `updateProfile()` - Update display info

**JwtSessionGuard** - Middleware
- Validates access token from cookie
- Attaches identity to request
- Verifies session not revoked

### Frontend Services

**AuthService** - Authentication Operations
- `login()` - Challenge-response login
- `logout()` - Revoke session
- `getCurrentUser()` - Get profile
- `refreshTokens()` - Refresh access token
- `getSessions()` - List active sessions
- `revokeSession()` - Revoke specific session

**AccountService** - Account Creation/Recovery
- `createAccountWithCloud()` - Cloud backup method
- `createAccountWithSelfCustody()` - Self-custody method
- `recoverWithPassword()` - Password recovery
- `recoverWithSeed()` - Seed recovery

**UserService** - Profile Management
- `getProfile()` - Get current profile
- `setUsername()` - Update handle
- `updateDisplayName()` - Update display name

---

## Challenge-Response Flow

```
Client                          Server
  │                               │
  ├─ POST /auth/login/challenge ─>│
  │  { publicKey, action }        │
  │                      [Generate Challenge]
  │<─ Challenge Response ─────────┤
  │  { challengeId, challenge }   │
  │                               │
  ├─ Sign Challenge ─────────────>│ (with private key)
  │ POST /auth/login              │
  │ { challengeId, signature }    │
  │                      [Verify Signature]
  │                      [Create/Get Identity]
  │                      [Create Session]
  │<─ Session Created ────────────┤
  │  Set HttpOnly Cookies         │
  │                               │
```

**Security Properties:**
- Challenge valid 2 minutes (Redis TTL)
- One-time use (deleted after validation)
- IP validation (prevent token theft)
- 5-attempt limit per challenge
- Ed25519 signature verification

---

## Default Identity Creation

When a user logs in with a new public key:

```
1. Check if Identity exists
   └─ If not: Create Identity with masterPublicKey

2. Generate default handle
   └─ Format: user_{SHA256(publicKey)[0:12]}
   └─ Example: user_a1b2c3d4e5f6

3. Create default profile
   └─ displayName: "Anonym User"

4. Create session with tokens
   └─ Access token (30 min)
   └─ Refresh token (30 days)

5. User can customize later
```

---

## Token Management

**Access Token:**
- Duration: 30 minutes
- Storage: HttpOnly cookie
- In DB: SHA256 hash (never plaintext)
- Validation: Hash comparison

**Refresh Token:**
- Duration: 30 days
- Storage: HttpOnly cookie
- In DB: Plaintext (mitigated by HttpOnly)
- Purpose: Obtain new access tokens

**Security Flags:**
- `HttpOnly: true` - Prevent XSS
- `Secure: true` (production) - HTTPS only
- `SameSite: strict` - CSRF protection

---

## Session Management

**Characteristics:**
- Maximum 5 active sessions per identity
- Device tracking (name, type, IP)
- Last activity timestamp
- Revocation support
- Active handle switching

**Lifecycle:**
1. Creation - New tokens issued
2. Validation - Token checked on each request
3. Refresh - New tokens from refresh token
4. Revocation - Marked as revoked (logout)
5. Expiration - Refresh token expires (30 days)

---

## Security Features

### 1. Cryptographic Authentication
- Ed25519 signatures prove key possession
- Server never sees private key
- Challenge-response prevents replay attacks

### 2. Private Key Management
- Ephemeral (generated only for auth)
- Destroyed immediately after use
- Overwritten with random data
- Hash-only storage for encryption

### 3. Token Security
- Access tokens hashed in database
- Refresh tokens short-lived (30 days)
- HttpOnly cookies prevent XSS
- Session limits prevent enumeration

### 4. Attack Prevention
- Rate limiting on auth endpoints
- Timing attack protection (random delays)
- Challenge attempt limiting (5 max)
- IP validation on challenges
- Brute force protection (exponential backoff)

### 5. Password Uniqueness
- PostgreSQL: Unique constraint on hash
- Proposed Redis: 24-hour TTL
- Prevents password collisions

---

## API Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/auth/login/challenge` | Request challenge | No |
| POST | `/auth/login` | Submit signature | No |
| POST | `/auth/dev-login` | Dev login | No |
| GET | `/auth/profile` | Get profile | Yes |
| GET | `/auth/sessions` | List sessions | Yes |
| POST | `/auth/sessions/revoke/:id` | Revoke session | Yes |
| POST | `/auth/sessions/revoke-all` | Revoke all | Yes |
| POST | `/auth/switch-handle` | Switch handle | Yes |
| POST | `/auth/logout` | Logout | Yes |
| POST | `/auth/refresh` | Refresh tokens | No |

---

## Related Documentation

See **ACCOUNT_CREATION_AND_PASSWORD_CLAIMS.md** for account creation and password management details.

See **IDENTITY_BASED_ARCHITECTURE.md** for entity relationships and data model.

---

_Last Updated: February 2, 2026_
