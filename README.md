# BeSafeChat - Secure Anonymous Messenger

## Overview

BeSafeChat is an end-to-end encrypted anonymous messenger that implements a unique Identity-Based Architecture. The system separates cryptographic identity from social identity, enabling secure communications without centralized account authorities.

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

#### Two-Stage Approach:

1. **Temporary Reservation (Redis)**: Uses atomic operations to prevent race conditions during account creation (24-hour TTL)
2. **Permanent Storage (PostgreSQL)**: Maintains unique password hashes with database-level constraints

#### Key Benefits:

- Prevents password collisions that could overwrite other users' seed backups
- Maintains zero-knowledge properties (server only sees password hashes)
- Provides immediate feedback if password is already in use
- Automatic cleanup of temporary reservations

#### Implementation Details:

- Password availability checked before account creation
- Unique password hashes stored in `permanent_password_hashes` table
- Rate limiting prevents abuse of password checking endpoints
- Atomic Redis operations ensure race condition safety

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
- **Solution**: Two-stage system with temporary Redis reservation and permanent PostgreSQL storage
- **Benefit**: Eliminates collision risk while maintaining usability

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
- `POST /password-recovery/lookup-identity` - Find identity by password hash

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
2. System verifies password hash is registered
3. Encrypted seed is downloaded from unique location
4. Seed is decrypted locally with user's password
5. Keys are regenerated and account is unlocked

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm run test
npm run test:e2e

# Frontend tests
cd frontend
npm run test
```

### Architecture Philosophy

- **Separation of Concerns**: Identity, handles, and profiles are distinct entities
- **Privacy First**: Server only sees public keys and encrypted data
- **Zero-Knowledge**: Cloud storage encrypted client-side
- **Collision Prevention**: Unique password enforcement system
- **Scalability**: Designed for growth with proper indexing and caching

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
