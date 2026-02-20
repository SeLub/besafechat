# BeSafeChat - Secure Anonymous Messenger

## Overview

BeSafeChat is an end-to-end encrypted anonymous messenger that implements a unique Identity-Based Architecture. The system separates cryptographic identity from social identity, enabling secure communications without centralized account authorities.

### Architecture Philosophy

- **Separation of Concerns**: Identity, handles, and profiles are distinct entities
- **Privacy First**: Server only sees public keys and encrypted data
- **Zero-Knowledge**: Cloud storage encrypted client-side
- **Collision Prevention**: Privacy-preserving password uniqueness enforcement
- **Scalability**: Designed for growth with proper indexing and caching

## Key Features

### 1. Identity-Based Architecture

- **Identity Entity**: Cryptographic foundation (Ed25519 public key)
- **Handle Entity**: Discoverable identifiers (username, email, phone, etc.)
- **Profile Entity**: Contextual representations (global, team, chat)

### 2. Zero-Knowledge Cloud Backup

- Seeds encrypted client-side with user password
- Cloud storage uses password-derived paths
- Server never sees plaintext seeds or passwords

### 3. Enhanced Security: Password Uniqueness Protection

To prevent collisions where users with identical passwords would have their encrypted seeds stored at the same location, we've implemented a robust password uniqueness system:

#### Privacy-Preserving Approach:

1. **Password Hash Tracking**: Uses a dedicated table `claimed_recovery_passwords` to track unique password hashes
2. **No Identity Links**: The table only stores the password hash, not linking it to any specific identity for privacy
3. **Database-Level Constraints**: UNIQUE constraint on password_hash prevents duplicates
4. **Atomic Operations**: PostgreSQL handles duplicate prevention reliably

#### Key Benefits:

- Prevents password collisions that could overwrite other users' seed backups
- Maintains zero-knowledge properties (server only sees password hashes, not the actual passwords or links to identities)
- Provides immediate feedback if password is already in use
- Preserves user privacy by not linking passwords to identities

#### Implementation Details:

- Password availability checked before account creation
- Unique password hashes stored in `claimed_recovery_passwords` table
- Rate limiting prevents abuse of password checking endpoints
- SHA-256 hashing used consistently across client and server

### 4. End-to-End Encryption

- Ed25519 key pairs for authentication
- BIP39 12-word seed phrases for key derivation
- Argon2id + AES-256-GCM for encryption
- Client-side encryption/decryption

### 5. Flexible Identity Management

- Multiple handles per identity
- Contextual profiles (global, team, chat)
- Hierarchical team structures
- Private, group, and team chats

## Authentication System Overview

### Core Authentication Flow

BeSafeChat uses **Ed25519 public key cryptography** combined with **challenge-response authentication** instead of traditional passwords:

```
1. Client generates Ed25519 key pair from seed phrase
2. Client requests authentication challenge from server
3. Server generates 256-bit random challenge (stored in Redis, 2-min TTL)
4. Client signs challenge with Ed25519 private key
5. Client sends signature to server
6. Server verifies signature with public key
7. On first login: System creates Identity with default Handle and Profile
8. Server creates Session with access and refresh tokens
9. Client destroys private key from memory
```

### Session Management

- **Access Token**: 30 minutes (HttpOnly cookie)
- **Refresh Token**: 30 days (HttpOnly cookie)
- **Session Limit**: Maximum 5 active sessions per identity
- **Device Tracking**: Records device name, type, IP address
- **Multi-Device**: Users can view and revoke sessions from other devices

### Default Identity Creation

When a user logs in with a new public key:

```
1. System creates Identity linked to Ed25519 public key
2. Generates default Handle: user_{SHA256(publicKey)[0:12]}
   Example: user_a1b2c3d4e5f6
3. Creates default Profile with displayName: "Anonym User"
4. User can customize handle and profile later in settings
```

### Authentication Security Features

- **Challenge-Response**: Prevents replay attacks (one-time use)
- **IP Validation**: Challenge must come from same IP as request
- **Attempt Limiting**: Maximum 5 failed attempts per challenge
- **Private Key**: Never stored; destroyed immediately after use
- **Token Hashing**: Access tokens hashed in database (never plaintext)
- **Rate Limiting**: Per-IP request limiting on auth endpoints
- **Timing Attack Protection**: Random delays (50-150ms)

### Key Authentication Endpoints

| Endpoint                    | Method | Purpose                  |
| --------------------------- | ------ | ------------------------ |
| `/auth/login/challenge`     | POST   | Request challenge        |
| `/auth/login`               | POST   | Submit signed challenge  |
| `/auth/profile`             | GET    | Get current user profile |
| `/auth/sessions`            | GET    | List active sessions     |
| `/auth/sessions/revoke/:id` | POST   | Revoke specific session  |
| `/auth/logout`              | POST   | Logout current session   |
| `/auth/refresh`             | POST   | Refresh access token     |

## Architecture Components

### Identity Entity

```typescript
@Entity('identities')
export class Identity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bytea', unique: true, nullable: true })
  masterPublicKey?: Buffer; // Ed25519 public key for E2EE

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Relationships
  @OneToMany(() => Handle, handle => handle.identity)
  handles!: Handle[];

  @OneToMany(() => Profile, profile => profile.identity)
  profiles!: Profile[];

  @OneToMany(() => Session, session => session.identity)
  sessions!: Session[];

  @OneToMany(() => TeamMembership, membership => membership.identity)
  teamMemberships!: TeamMembership[];

  @OneToMany(() => ChatMember, member => member.identity)
  chatMemberships!: ChatMember[];

  @OneToMany(() => ContactRequest, req => req.fromIdentity)
  sentContactRequests!: ContactRequest[];

  @OneToMany(() => ContactRequest, req => req.toIdentity)
  receivedContactRequests!: ContactRequest[];

  @OneToMany(() => MessageMetadata, msg => msg.senderIdentity)
  sentMessages!: MessageMetadata[];
}
```

### Handle Entity

```typescript
@Entity('handles')
@Index(['value', 'type'], { unique: true })
export class Handle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  value!: string; // The actual handle value

  @Column({
    type: 'enum',
    enum: ['username', 'email', 'phone', 'generated', 'team', 'federation', 'custom'],
    default: 'username',
  })
  type!: HandleType;

  @Column({ type: 'boolean', default: false })
  isSearchable!: boolean; // Whether this handle can be discovered

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean; // Primary handle for display

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean; // Verification status

  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Foreign keys
  @Column({ type: 'uuid' })
  identityId!: string;

  @ManyToOne(() => Identity, identity => identity.handles, { onDelete: 'CASCADE' })
  identity!: Identity;

  @Column({ type: 'uuid', nullable: true })
  teamId?: string;
}
```

### Profile Entity

```typescript
@Entity('profiles')
@Index(['identityId', 'contextType', 'contextId'], { unique: true })
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ['global', 'team', 'chat', 'organization'],
    default: 'global',
  })
  contextType!: ProfileContextType;

  @Column({ type: 'uuid', nullable: true })
  contextId?: string;

  @Column({ type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: {
    showEmail: boolean;
    showPhone: boolean;
    showPresence: boolean;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'uuid' })
  identityId!: string;

  @ManyToOne(() => Identity, identity => identity.profiles, { onDelete: 'CASCADE' })
  identity!: Identity;

  @ManyToOne(() => Team, { nullable: true, onDelete: 'CASCADE' })
  team?: Team;
}
```

## Security Features

### 1. Password Uniqueness Protection

- **Problem**: Users with same password would have same S3 storage path
- **Solution**: Privacy-preserving system with database-level uniqueness enforcement
- **Benefit**: Eliminates collision risk while maintaining user privacy

### 2. Challenge-Response Authentication

- Server generates cryptographic challenges
- Client signs challenges with private key
- Server verifies signatures with public key
- Zero-knowledge approach (server never sees private key)

### 3. Secure Seed Management

- BIP39 12-word seed phrases
- Argon2id key derivation with 256-bit keys
- AES-256-GCM authenticated encryption
- Client-side encryption/decryption

### 4. Rate Limiting

- Per-IP request limiting
- Special protection for recovery endpoints
- Prevention of brute-force attacks

## API Endpoints

### Password Recovery Endpoints

- `POST /password-recovery/check-availability` - Check if password is available
- `POST /password-recovery/claim` - Claim password for exclusive use

### Authentication Endpoints

- `POST /auth/login/challenge` - Request login challenge
- `POST /auth/login` - Complete login with challenge signature
- `POST /auth/register/challenge` - Request registration challenge
- `POST /auth/register` - Complete registration with challenge signature

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Tebi.io S3 account for file storage

### Installation

```bash
# Backend
cd backend
npm install
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

### HTTPS Development Setup (Local Network Testing)

For testing on local network devices (Android, other computers), generate HTTPS certificates:

```bash
# In backend directory
cd backend

# Create certificate authority
pnpm dlx mkcert create-ca

# Create certificates for development
pnpm dlx mkcert create-cert --domains 192.168.100.35 localhost 127.0.0.1
```

This generates:

- `ca.crt` - Certificate Authority (add to your OS/browser)
- `ca.key` - CA private key
- `cert.crt` - Server certificate
- `cert.key` - Server private key

**Note**: These files are not committed to Git. Each developer must generate their own certificates.

**Enable HTTPS**: Set `HTTPS=true` in `.env`

**Import CA into browsers** (recommended):

- **Firefox**: Preferences → Certificates → Import `ca.crt`
- **Chrome**: Settings → Security → Manage certificates → Import `ca.crt`
- **Android**: Settings → Security → Install from storage → select `ca.crt`

If certificates are missing, the backend falls back to HTTP with a warning message.

### Environment Variables

```env
# Backend
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=user
DB_PASSWORD=secure_password
DB_DATABASE=messenger
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
REDIS_PASSWORD=redis_secure
S3_ENDPOINT=https://s3.tebi.io
S3_BUCKET_NAME=besafe.backet
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key

# Frontend
VITE_API_BASE_URL=http://localhost:4000
```

## Usage

### Account Creation

1. User chooses password for cloud recovery
2. System checks password uniqueness
3. If unique, seed is generated and encrypted with password
4. Encrypted seed is uploaded to unique S3 location
5. Password hash is permanently recorded to prevent reuse

### Account Recovery

1. User enters their password
2. Client computes storage path from password using same algorithm as during backup
3. Encrypted seed is downloaded from unique location based on password hash
4. Seed is decrypted locally with user's password
5. Keys are regenerated and account is unlocked

## Development

### Testing

BeSafeChat uses a comprehensive testing strategy with **80 test cases** across **19 test files**.

#### Test Infrastructure

- **Backend**: Jest (15 test files, 47 tests)
- **Frontend**: Vitest (4 test files, 33 tests)
- **Coverage**: Authentication, password recovery, notifications, identity management

#### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run specific domain
npm test -- tests/unit/notification.service.spec.ts
npm test -- tests/integration

# Watch mode
npm test -- --watch
```

**Test Structure**:

```
backend/tests/
├── unit/                    # Isolated component tests
│   ├── auth-service-minimal-fixed.spec.ts
│   ├── challenge-service-minimal-fixed.spec.ts
│   ├── session-refresh-minimal.spec.ts
│   ├── password-recovery.service.spec.ts
│   ├── notification.service.spec.ts
│   └── ...
└── integration/             # Cross-component tests
    ├── auth-integration-minimal-fixed.spec.ts
    ├── password-recovery.integration.spec.ts
    ├── notification.integration.spec.ts
    └── ...
```

#### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run specific test
npm test -- tests/unit/notification-history.spec.ts

# Run once (no watch)
npm test -- --run
```

**Test Structure**:

```
frontend/tests/
└── unit/
    ├── notification-history.spec.ts
    ├── password-recovery-simple.spec.ts
    ├── auth-guard-minimal.spec.ts
    └── phase5-encryption-validation.spec.ts
```

#### Test Coverage by Domain

| Domain            | Unit Tests | Integration Tests | Total  |
| ----------------- | ---------- | ----------------- | ------ |
| Authentication    | 3          | 1                 | 4      |
| Password Recovery | 2          | 1                 | 3      |
| Notifications     | 1          | 1                 | 2      |
| Identity/Handle   | 2          | 3                 | 5      |
| Frontend          | 4          | -                 | 4      |
| **Total**         | **12**     | **6**             | **18** |

#### Key Test Files

**Authentication**:

- `auth-service-minimal-fixed.spec.ts` - Login, identity creation, session management
- `challenge-service-minimal-fixed.spec.ts` - Challenge-response, signature verification
- `session-refresh-minimal.spec.ts` - Token refresh, expiration handling

**Password Recovery**:

- `password-recovery.service.spec.ts` - Hash uniqueness, claiming, conflicts
- `password-recovery.integration.spec.ts` - End-to-end recovery flow
- `password-recovery-simple.spec.ts` (frontend) - Availability check, retry logic

**Notifications**:

- `notification.service.spec.ts` - Redis operations, unread tracking
- `notification.integration.spec.ts` - Multi-device sync, mark as read
- `notification-history.spec.ts` (frontend) - Type validation, data structures

**Identity Management**:

- `test-handle-generation.spec.ts` - Default handle from public key
- `test-alias-availability.spec.ts` - Uniqueness validation
- `test-full-registration-flow.spec.ts` - Complete user registration

For detailed testing documentation, see `.kilocode/rules/memory-bank/TESTING_SUMMARY.md`.

### Running Tests

### Running the Application

```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

For security concerns, please contact the maintainers directly. Do not create public issues for security vulnerabilities.

---

_BeSafeChat - Your privacy, your control_
