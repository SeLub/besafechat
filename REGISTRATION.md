# User Registration and Login Flow Analysis for BeSafe Chat

## Overview
BeSafe Chat implements a sophisticated authentication system based on cryptographic key pairs (Ed25519) combined with handle-based identification. The authentication flow emphasizes privacy, security, and anonymity, using public key cryptography as the foundation for identity rather than traditional passwords.

## Backend Authentication Architecture

### Key Components:
1. **Identity Service**: Manages cryptographic identities based on Ed25519 public keys
2. **Session Service**: Handles active sessions and token management  
3. **Handle Service**: Manages user handles (handles/aliases) associated with identities
4. **Profile Service**: Stores display profiles linked to handles

### Login Process (`/auth/login`):
1. Client sends public key and device information
2. System looks up existing identity by public key
3. If no identity exists, creates a new one with default handle and profile:
   - Auto-generates handle in format `user_{hash}` using public key hash
   - Creates default profile with display name "Anonym User"
   - Sets handle as searchable by default
4. Creates new session with access and refresh tokens
5. Sets HttpOnly cookies for secure token storage
6. Returns session and identity information

### Security Mechanisms:
- **Public Key Authentication**: Uses Ed25519 key pairs for strong cryptographic authentication
- **Token Management**: Separate access tokens (30 min expiry) and refresh tokens (30 days expiry)
- **HttpOnly Cookies**: Secure token storage to prevent XSS attacks
- **Session Limits**: Maximum of 5 active sessions per identity
- **IP Tracking**: Records IP addresses for session monitoring
- **JWT Session Guard**: Validates tokens on protected routes

## Frontend Authentication Workflow

### Account Creation Options:
1. **Cloud Backup Method**: Generates seed phrase, encrypts it with user password, stores encrypted version on server
2. **Self-Custody Method**: Generates seed phrase that the user must securely store locally

### Registration Flow:
1. User selects authentication method (cloud or self-custody)
2. For cloud method: user creates password, system generates and encrypts seed
3. For self-custody: user sees and verifies seed phrase
4. System generates Ed25519 key pair from seed
5. Public key is stored locally in browser indexedDB
6. Backend login occurs with public key (creating identity with default handle/profile)
7. User is redirected to main page
8. Later, user can customize their handle in Settings if desired

### Login Flow:
1. Application checks for locally stored public key
2. If key exists, performs login using stored public key
3. If no key exists, prompts for account creation or recovery
4. Backend validates public key and creates session (with default handle/profile if first time)
5. Authentication context is established
6. User is directed to main application

### Handle Customization Flow (Optional):
1. User navigates to Settings page
2. User selects custom handle name
3. Frontend calls UserService.setUsername() which uses handles API endpoints
4. Handle and profile are updated via dedicated endpoints

#### Recovery Options:
1. **Password Recovery**: Uses encrypted seed backup from cloud
2. **Seed Phrase Recovery**: Uses user-stored seed phrase to regenerate keys

## Complete Authentication Flow Summary

The authentication system combines cryptographic security with user-friendly interfaces:

1. **Initial Setup**: User chooses authentication method (cloud or self-custody)
2. **Key Generation**: Ed25519 key pair generated from mnemonic seed
3. **Key Storage**: Public key stored locally, private key secured according to chosen method
4. **Backend First Login**: Public key sent to backend, identity created with default handle (user_...) and profile (Anonym User)
5. **Handle Customization (Optional)**: User can later replace default handle with custom one via handles endpoints
6. **Session Establishment**: Tokens issued for ongoing authentication
7. **Ongoing Access**: Subsequent logins use stored public key for seamless access
8. **Security Features**: Multiple sessions, device management, and token refresh capabilities

This design ensures strong security through cryptographic authentication while maintaining user anonymity and allowing flexible access methods. The system prioritizes privacy by using public key cryptography as the primary identifier, eliminating the need for passwords in the authentication process itself while providing users with familiar handle-based identification for social interactions.

---

## Function-Level Analysis of User Registration and Login Flow

### Backend Authentication Functions

#### 1. **AuthSessionController.login()**
```typescript
async login(@Body() loginDto: LoginDto, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) res: ResponseWithCookies)
```
- **Purpose**: Authenticates user login using public key
- **Input**: Public key and device information
- **Process**:
  - Calls AuthService.loginWithPublicKey() to authenticate and create session
  - Sets authentication cookies with access and refresh tokens
  - Returns login success response with identity and session info

#### 2. **AuthService.loginWithPublicKey()**
```typescript
async loginWithPublicKey(publicKeyBase64: string, deviceName: string, ...)
```
- **Purpose**: Core login logic using public key authentication
- **Input**: Base64-encoded public key and device information
- **Process**:
  - Calls IdentityService.findByIdentityPublicKey() to find existing identity
  - If identity doesn't exist, registers a new one with default handle and profile:
    - Generates handle from public key hash (format: user_...)
    - Creates default profile with "Anonym User" display name
    - Sets handle as searchable by default
  - Calls SessionService.createSession() to establish new session
  - Returns session, tokens, and identity information

#### 3. **IdentityService.registerIdentity()**
```typescript
async registerIdentity(publicKeyBase64: string): Promise<Identity>
```
- **Purpose**: Creates or retrieves a user identity based on public key
- **Input**: Base64-encoded public key
- **Process**:
  - Decodes and validates public key format (should be 32 bytes)
  - Checks if identity already exists with this public key
  - If not found, creates new Identity entity with the public key
  - Returns existing or newly created Identity record

#### 4. **HandleService.createHandle()**
```typescript
async createHandle(params: { value: string, type: string, ownerIdentityId: string, isSearchable: boolean, isPrimary: boolean })
```
- **Purpose**: Creates a handle for an identity
- **Input**: Handle value, type, owner identity ID, searchable flag, primary flag
- **Process**:
  - Validates handle uniqueness within database
  - Creates new Handle entity linked to identity
  - Sets handle properties (type, searchable, primary)
  - Returns created Handle record

#### 5. **ProfileService.createProfile()**
```typescript
async createProfile(params: { handleId: string, displayName: string })
```
- **Purpose**: Creates a profile linked to a handle
- **Input**: Handle ID and display name
- **Process**:
  - Links profile to specific handle
  - Sets display name and initializes other profile fields
  - Returns created Profile record

#### 6. **SessionService.createSession()**
```typescript
async createSession(identityId: string, deviceName: string, deviceType?: string, ipAddress?: string, userAgent?: string, activeHandleId?: string)
```
- **Purpose**: Creates a new session for a user identity
- **Input**: Identity ID, device info, IP address, user agent, active handle ID
- **Process**:
  - Enforces maximum of 5 active sessions per identity
  - Determines active handle (uses primary handle if not specified)
  - Generates access and refresh tokens (random hex strings)
  - Creates Session entity with all the provided information
  - Hashes access token for secure storage
  - Sets session expiry (30 days)
  - Returns session object and raw tokens

#### 7. **JwtSessionGuard.canActivate()**
```typescript
async canActivate(context: ExecutionContext): Promise<boolean>
```
- **Purpose**: Validates authentication for protected routes
- **Input**: HTTP request context
- **Process**:
  - Extracts access token from cookies
  - Calls SessionService.validateAccessToken() to verify token
  - Checks if session is active and not revoked
  - Attaches user identity information to request object
  - Returns true if authenticated, throws UnauthorizedException otherwise

#### 8. **SessionService.validateAccessToken()**
```typescript
async validateAccessToken(accessToken: string): Promise<Session | null>
```
- **Purpose**: Validates an access token against stored session
- **Input**: Raw access token
- **Process**:
  - Hashes the incoming token and looks up in database
  - Checks if session is revoked or expired
  - Updates last active timestamp
  - Returns session object if valid, null otherwise

#### 9. **AuthService.refreshTokens()**
```typescript
async refreshTokens(refreshToken: string, ipAddress?: string)
```
- **Purpose**: Refreshes access token using refresh token
- **Input**: Refresh token and IP address
- **Process**:
  - Finds session by refresh token
  - Verifies session is active and not expired
  - Generates new access and refresh tokens
  - Updates session with new tokens and expiry
  - Returns new tokens and session information

#### 10. **AuthService.generateHandleFromPublicKey()**
```typescript
generateHandleFromPublicKey(publicKeyBase64: string): string
```
- **Purpose**: Generates a unique handle from the public key
- **Input**: Base64-encoded public key
- **Process**:
  - Decodes base64 public key to buffer
  - Creates SHA256 hash of the public key
  - Takes first 12 characters of hash
  - Formats as "user_{hash}"
  - Returns generated handle string

### Frontend Authentication Functions

#### 11. **AuthService.login()**
```typescript
static async login(credentials: LoginCredentials)
```
- **Purpose**: Sends login request to backend
- **Input**: Public key, optional device ID, and device name
- **Process**:
  - Makes POST request to `/auth/login` endpoint
  - Includes public key, device name and ID in payload
  - Sets authentication cookies automatically (due to credentials: 'include')
  - Parses and validates backend response
  - Returns login result on success, throws error on failure

#### 12. **AccountService.createAccountWithCloud()**
```typescript
static async createAccountWithCloud(password: string)
```
- **Purpose**: Creates account using cloud backup method
- **Input**: User password for encryption
- **Process**:
  - Generates random mnemonic seed phrase
  - Derives Ed25519 key pair from seed
  - Stores public key in local indexedDB
  - Logs into backend using public key (creates identity with default handle/profile)
  - Encrypts seed with user password and uploads to cloud
  - Returns key pair and userId

#### 13. **AccountService.createAccountWithSelfCustody()**
```typescript
static async createAccountWithSelfCustody()
```
- **Purpose**: Creates account using self-custody method
- **Input**: None
- **Process**:
  - Generates random mnemonic seed phrase
  - Derives Ed25519 key pair from seed
  - Stores public key in local indexedDB
  - Logs into backend using public key (creates identity with default handle/profile)
  - Does not upload seed to cloud (user responsible for backup)
  - Returns key pair and userId

#### 14. **AuthRoute.handleUsernameSelected()**
```typescript
const handleUsernameSelected = async (selectedUsername: string)
```
- **Purpose**: Handles username/alias selection after registration
- **Input**: Selected username string
- **Process**:
  - Calls UserService.setUsername() to update backend with username
  - Redirects user to main application
  - Updates UI with success message

#### 15. **AuthRoute.handleLogin()**
```typescript
const handleLogin = async ()
```
- **Purpose**: Handles login for returning users
- **Process**:
  - Retrieves stored public key from indexedDB
  - Calls AuthService.login() with public key
  - Redirects user to main application
  - Updates UI with success or error message

### Authentication Token Management Functions

#### 16. **setAuthCookies()** (private in AuthSessionController)
```typescript
private setAuthCookies(res: ResponseWithCookies, accessToken: string, refreshToken: string)
```
- **Purpose**: Sets secure authentication cookies
- **Input**: Response object, access token, refresh token
- **Process**:
  - Sets HttpOnly access token cookie (30 minutes expiry)
  - Sets HttpOnly refresh token cookie (30 days expiry) 
  - Applies security flags (secure, sameSite: strict)

#### 17. **useAuth.checkAuth()**
```typescript
const checkAuth = async ()
```
- **Purpose**: Verifies if user session is still valid
- **Process**:
  - Makes request to `/auth/profile` endpoint
  - Checks if backend recognizes current session
  - Updates local user state based on response
  - Clears cookies if session is invalid

This function-level breakdown shows how each component contributes to the complete authentication flow, from initial identity creation with default handle/profile through session management and protection of application resources. The updated system properly separates concerns by removing the `/auth/register` endpoint in favor of dedicated handle and profile API endpoints.