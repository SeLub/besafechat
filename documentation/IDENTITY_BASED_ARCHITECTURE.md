# BeSafeChat Identity-Based Architecture

**Document Version:** 1.0  
**Last Updated:** February 2, 2026  
**Status:** Code-verified and complete

---

## Overview

BeSafeChat implements a sophisticated **Identity-Based Architecture** that separates cryptographic identity from social identity, enabling privacy, flexibility, and organizational support.

**Core Philosophy:**
- **Identity** = Cryptographic foundation (Ed25519 public key)
- **Handle** = Social identifier (username, discoverable)
- **Profile** = Display information (context-specific)
- **Session** = Device management (tokens, device info)

---

## Architecture Components

### Entity Relationship Diagram

```
Identity (Root - Cryptographic)
  ├─── Handle (1:Many)
  │     ├─── value: unique username
  │     ├─── isPrimary: one per identity
  │     ├─── isSearchable: privacy control
  │     └─── Profile (1:1)
  │           ├─── displayName
  │           ├─── avatar
  │           ├─── bio
  │           └─── settings (privacy)
  │
  └─── Session (1:Many, Max 5)
        ├─── activeHandle (references Handle)
        ├─── tokens (access + refresh)
        ├─── device info (name, type, IP)
        └─── timestamps (created, expires, lastActive)
```

---

## Identity Entity

### Definition

```typescript
@Entity('identities')
export class Identity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bytea', unique: true, nullable: true })
  masterPublicKey?: Buffer; // Ed25519 public key (32 bytes)

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Relationships
  @OneToMany(() => Handle, handle => handle.ownerIdentity)
  handles!: Handle[];

  @OneToMany(() => Profile, profile => profile.identity)
  profiles!: Profile[];

  @OneToMany(() => Session, session => session.identity)
  sessions!: Session[]; // Max 5 active sessions

  @OneToMany(() => TeamMembership, membership => membership.identity)
  teamMemberships!: TeamMembership[];

  @OneToMany(() => ChatMember, member => member.identity)
  chatMemberships!: ChatMember[];
}
```

### Characteristics

| Feature | Details |
|---------|---------|
| **Unique Identifier** | UUID primary key |
| **Cryptographic Key** | Ed25519 public key (32 bytes, UNIQUE) |
| **Immutable** | Cannot be changed after creation |
| **Creation** | Automatic on first login with new public key |
| **Relationships** | One-to-Many to Handles, Profiles, Sessions |
| **Cascade Delete** | Deleting identity removes all related entities |

---

## Handle Entity

### Definition

```typescript
@Entity('handles')
@Index(['value', 'type'], { unique: true })
export class Handle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  value!: string; // Username (unique per type)

  @Column({
    type: 'enum',
    enum: ['account', 'team', 'channel', 'federation'],
    default: 'account',
  })
  type!: HandleType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alias?: string; // Alternative display name

  @Column({ type: 'boolean', default: false })
  isSearchable!: boolean; // Can be found in search?

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean; // Primary handle (one per identity)

  @Column({ type: 'boolean', default: false })
  isVerified!: boolean; // Verification status

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  // Relationships
  @Column({ type: 'uuid' })
  ownerIdentityId!: string;

  @ManyToOne(() => Identity, identity => identity.handles, { 
    onDelete: 'CASCADE' 
  })
  ownerIdentity!: Identity;

  @OneToOne(() => Profile, profile => profile.handle)
  profile?: Profile;
}
```

### Handle Types

| Type | Purpose | Usage |
|------|---------|-------|
| **account** | Personal user identity | Default, searchable, one primary |
| **team** | Team/organization identity | Team channels |
| **channel** | Topic-specific identity | Channel conversations |
| **federation** | External system identity | Cross-platform |

---

## Profile Entity

### Definition

```typescript
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  handleId!: string;

  @OneToOne(() => Handle, handle => handle.profile, { 
    onDelete: 'CASCADE' 
  })
  handle!: Handle;

  @Column({ type: 'varchar', length: 255 })
  displayName!: string; // Public display name

  @Column({ type: 'varchar', length: 100, nullable: true })
  firstName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName?: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl?: string; // S3 URL

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'jsonb', default: {} })
  settings!: {
    showEmail?: boolean;
    showPhone?: boolean;
    showLastSeen?: boolean;
  };

  @Column({ type: 'jsonb', default: {} })
  metadata?: { lastActive?: Date };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
```

### Profile Characteristics

| Feature | Details |
|---------|---------|
| **One-Per-Handle** | Each handle has exactly one profile |
| **Display Info** | displayName, avatar, bio |
| **Privacy Controlled** | Granular settings for sensitive data |
| **Extensible** | Metadata field for custom data |
| **Mutable** | Can be updated by owner |

---

## Session Entity

### Definition

```typescript
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  identityId!: string;

  @ManyToOne(() => Identity, identity => identity.sessions, { 
    onDelete: 'CASCADE' 
  })
  identity!: Identity;

  @Column({ type: 'uuid', nullable: true })
  activeHandleId?: string;

  @ManyToOne(() => Handle, { nullable: true })
  activeHandle?: Handle;

  @Column({ type: 'varchar', length: 255 })
  deviceName!: string; // e.g., "Chrome on Windows"

  @Column({
    type: 'enum',
    enum: ['mobile', 'desktop', 'web'],
    nullable: true,
  })
  deviceType?: 'mobile' | 'desktop' | 'web';

  @Column({ type: 'text' })
  accessTokenHash!: string; // SHA256 hash (never plaintext)

  @Column({ type: 'text' })
  refreshToken!: string; // Short-lived, plaintext

  @Column({ type: 'varchar', length: 50, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date; // 30 days from creation

  @UpdateDateColumn({ type: 'timestamptz' })
  lastActiveAt!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;
}
```

### Session Characteristics

| Feature | Details |
|---------|---------|
| **Token Management** | Access (30 min), Refresh (30 days) |
| **Device Tracking** | Device name, type, IP, user agent |
| **Session Limits** | Maximum 5 active per identity |
| **Revocation** | Can be logged out |
| **Activity Tracking** | Last active timestamp |
| **Security** | Hashed access tokens, HttpOnly cookies |

---

## Use Cases

### Use Case 1: Simple Registration

```
User creates account → Generate keys → Login → 
Auto-created handle (user_xxxxx) → Auto-created profile (Anonym User) → 
Can customize later
```

### Use Case 2: Multiple Handles

```
One Identity:
  ├─ Handle: "john" (personal)
  ├─ Handle: "john_gaming" (gaming)
  └─ Handle: "developer_john" (professional)

Each with independent profile and searchability
```

### Use Case 3: Team Organization

```
Identity: admin_user
  ├─ Handle: "admin" (personal)
  └─ Handle: "dev_team" (type: team)
       └─ Members can switch to team context
```

### Use Case 4: Privacy Control

```
Profile Settings:
  ├─ showEmail: true (visible)
  ├─ showPhone: false (hidden)
  └─ showLastSeen: false (hidden)
```

### Use Case 5: Multi-Device

```
Identity: alice
  ├─ Session 1: iPhone (Chrome)
  ├─ Session 2: MacBook (Safari)
  └─ Session 3: iPad (Safari)
       └─ User can revoke any session
```

---

## Design Patterns

### 1. Separation of Concerns

**Identity:** Cryptographic only
- masterPublicKey
- Immutable
- Used for authentication only

**Handle:** Social identifier
- value (username)
- type (account/team/channel)
- searchability control

**Profile:** Display information
- displayName, avatar, bio
- Privacy settings
- Metadata extensibility

**Session:** Device management
- tokens
- device info
- activity tracking

### 2. Privacy by Design

**Public Data:**
- Handle value (if searchable)
- Display name
- Avatar

**Privacy-Controlled:**
- Email (showEmail: boolean)
- Phone (showPhone: boolean)
- Last seen (showLastSeen: boolean)

**System-Only:**
- masterPublicKey
- Session tokens
- IP addresses

### 3. Cascade Behavior

```
Delete Identity
  ├─ Delete all Handles
  │  └─ Delete linked Profiles
  ├─ Delete all Sessions
  └─ Delete memberships
```

---

## Security Properties

### Identity Security
✅ Ed25519 cryptographically unique
✅ Immutable once created
✅ UNIQUE constraint prevents duplicates
✅ Never transmitted in plaintext

### Handle Security
✅ User-controlled, can be changed
✅ Searchability user-controlled
✅ Not used for authentication

### Profile Security
✅ Privacy controls for sensitive data
✅ Display-only, no authentication
✅ Granular settings

### Session Security
✅ Access tokens hashed in database
✅ HttpOnly cookies prevent XSS
✅ Session limits (max 5)
✅ Device tracking for auditing

---

## Comparison: Before vs After

### User-Based Model (Problems)
❌ Username required for auth
❌ Password storage risks
❌ No multi-identity support
❌ No device management
❌ No context-specific profiles
❌ Email/username tightly coupled

### Identity-Based Model (Benefits)
✅ Cryptographic authentication (no passwords)
✅ Multiple social identities
✅ Device management (max 5 sessions)
✅ Context-specific profiles
✅ Flexible identity model
✅ Granular privacy controls

---

_Last Updated: February 2, 2026_
