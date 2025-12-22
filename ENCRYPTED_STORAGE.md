# Encrypted Storage in BeSafeChat

## Overview

BeSafeChat implements comprehensive end-to-end encryption for locally stored messages and sensitive data. All data stored in IndexedDB is encrypted using user-specific keys to ensure privacy and security.

## Encryption Algorithms

### Primary Encryption Algorithm
- **AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)** with 256-bit keys
- Provides both confidentiality and authenticity
- Uses 12-byte initialization vector (IV) and 16-byte authentication tag (authTag)

### Key Derivation Function
- **PBKDF2 (Password-Based Key Derivation Function 2)** with SHA-256
- 210,000 iterations for strong key stretching
- Uses salt values to prevent rainbow table attacks

## Storage Service Architecture

### StorageService Class
The central component managing all encrypted storage operations is the `StorageService` class located in `frontend/app/services/storage.service.ts`.

### Key Methods
- `saveEncryptedMessage()` - Encrypts and stores messages
- `loadDecryptedMessages()` - Retrieves and decrypts messages
- `encryptTextData()` - General-purpose text encryption
- `encryptBinaryData()` - Binary data encryption for files
- `decryptData()` - General-purpose decryption
- `decryptTextData()` - Text decryption

## Encryption Process

### Message Encryption Flow
1. Text content is converted to UTF-8 bytes
2. User ID is used as passphrase for encryption
3. PBKDF2 derives a key using 210,000 iterations
4. AES-GCM encrypts the content with a random IV
5. Authentication tag is generated and stored separately
6. Salt, IV, ciphertext, and authTag are stored in IndexedDB

### Data Structure
Encrypted storage includes:
- `encrypted`: The ciphertext (without authTag)
- `salt`: 32-byte salt for key derivation
- `iv`: 12-byte initialization vector
- `authTag`: 16-byte authentication tag
- `version`: Encryption version (currently 1 or 2)
- `context`: Data type ('message', 'contact', 'metadata', 'file')
- `timestamp`: When the data was encrypted

## Security Features

### Key Management
- User-specific encryption keys derived from user ID
- Unique salt for each encrypted item
- PBKDF2 with high iteration count for key stretching
- Versioning system for encryption algorithm evolution

### Data Protection
- Messages are encrypted before being stored in IndexedDB
- Even if IndexedDB is compromised, message content remains secure
- Authentication tags prevent tampering
- Separate storage of authTag and ciphertext for additional security

## Services Integration

### Crypto Library
The `@/lib/crypto` module provides core encryption functions:
- `encryptWithPassphrase()` - High-level encryption interface
- `decryptWithPassphrase()` - High-level decryption interface
- `generateSalt()` - Secure random salt generation
- `randomBytes()` - Cryptographically secure random data

### Database Integration
- Uses Dexie.js wrapper (`@/lib/db.ts`) for IndexedDB operations
- All operations are performed through the StorageService
- Direct IndexedDB access has been removed from other components

## Message Lifecycle

### Storing a Message
1. User sends message through UI
2. `StorageService.saveEncryptedMessage()` encrypts the content
3. Encrypted data is stored in the `messages` table in IndexedDB
4. Message is also sent to recipient via WebSocket

### Loading Messages
1. `StorageService.loadDecryptedMessages()` retrieves encrypted data from IndexedDB
2. Messages are decrypted using the user's ID as passphrase
3. Decrypted content is returned to the UI for display
4. Failed decryption attempts are handled gracefully with error messages

## Performance Considerations

### Encryption Overhead
- AES-GCM provides good performance for both encryption and decryption
- PBKDF2 iterations are optimized for security vs. performance balance
- Bulk operations are supported for efficient message handling

### Storage Efficiency
- Encrypted data is stored in ArrayBuffer format for efficiency
- Conversion utilities ensure proper data type handling
- Message cleanup operations maintain storage limits

## Error Handling

### Decryption Failures
- Failed decryption attempts return placeholder messages
- Errors are logged for debugging purposes
- User experience is maintained even with corrupted data

### Security Validation
- All encrypted data includes version information
- Unsupported encryption versions are rejected
- Authentication tags are verified before decryption

## Backup and Recovery

### Cloud Backup
- Encrypted seed phrases are stored separately using CloudBackupService
- Seeds are encrypted with user passwords before cloud storage
- Recovery operations decrypt seeds using user credentials

### Local Backup
- Users can download encrypted backups of their seed phrases
- Backups are password-protected and encrypted
- Recovery flow validates and decrypts seeds properly

## Security Benefits

1. **Data Protection**: Messages remain encrypted even when stored locally
2. **Privacy**: No plain text data accessible through browser developer tools
3. **Tamper Resistance**: Authentication tags prevent data manipulation
4. **Key Isolation**: Each user's data is encrypted with their specific keys
5. **Forward Secrecy**: Compromised keys don't affect previously encrypted messages

This encryption system ensures that even if an attacker gains access to the user's device or browser storage, the actual message content remains secure and unreadable without the proper decryption keys.