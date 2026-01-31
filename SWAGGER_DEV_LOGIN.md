# Development Login Endpoint

## Overview

The `/auth/dev-login` endpoint is available **only in development mode** (`NODE_ENV=development`) for testing and developing with Swagger UI without requiring cryptographic signature validation.

## Requirements

- `NODE_ENV=development` must be set in your backend environment
- The endpoint will return a 400 error if run in production mode

## Endpoint Details

### URL
```
POST /auth/dev-login
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `publicKey` | string | Yes | Base64-encoded Ed25519 public key (any valid public key works) |
| `deviceId` | string | Yes | Device identifier (e.g., `device-b737cab1`) |
| `deviceName` | string | Yes | Device name (e.g., `Chrome on Windows`) |

### Response (Success - 200)

```json
{
  "success": true,
  "data": {
    "identityId": "550e8400-e29b-41d4-a716-446655440000",
    "sessionId": "session-abc123",
    "handleId": "handle-550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Response (Error - 400)

```json
{
  "success": false,
  "error": "This endpoint is only available in development mode (NODE_ENV=development)"
}
```

## How to Use in Swagger UI

### Step 1: Enable Development Mode

Make sure your backend `.env` has:
```env
NODE_ENV=development
```

### Step 2: Open Swagger UI

Navigate to `http://localhost:4000/swagger` (or your Swagger URL)

### Step 3: Find the `/auth/dev-login` Endpoint

Look for the **POST** `/auth/dev-login` endpoint with description:
> "Development/Testing endpoint - Login without challenge-response"

### Step 4: Click "Try it out"

### Step 5: Enter Request Body

Use any valid Base64 public key. Example:

```json
{
  "publicKey": "k4xCEjdeLFvzEJ0OOamRdiDJbgKZQdGFyCPlMlr+fg8=",
  "deviceId": "device-b737cab1",
  "deviceName": "Chrome on Windows"
}
```

Or generate a random public key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 6: Execute

Click "Execute" button.

### Step 7: Check Response

You should get a 200 response with session cookies automatically set by Swagger UI.

### Step 8: Authenticated Requests

Now you can test other protected endpoints (marked with 🔒) as Swagger UI will automatically include the session cookies.

## Example cURL Command

```bash
curl -X POST http://localhost:4000/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "k4xCEjdeLFvzEJ0OOamRdiDJbgKZQdGFyCPlMlr+fg8=",
    "deviceId": "device-b737cab1",
    "deviceName": "Chrome on Windows"
  }' \
  -c cookies.txt

# Then use authenticated endpoints
curl http://localhost:4000/auth/profile -b cookies.txt
```

## Differences from Production `/auth/login`

| Feature | `/auth/login` (Production) | `/auth/dev-login` (Dev) |
|---------|---------------------------|------------------------|
| Challenge-response required | ✅ Yes | ❌ No |
| Signature verification | ✅ Yes | ❌ No |
| Public key validation | ✅ Yes (must match) | ✅ Yes (any key works) |
| Session creation | ✅ Yes | ✅ Yes |
| Cookies set | ✅ Yes | ✅ Yes |
| Available in production | ✅ Yes | ❌ No (403 error) |
| Available in development | ✅ Yes | ✅ Yes |

## Security Notes

- 🔒 This endpoint **only works in development mode** (`NODE_ENV=development`)
- 🔒 Production deployments will return a 400 error if someone tries to access it
- 🔒 No cryptographic verification is performed - this is **for development/testing only**
- ⚠️ Never set `NODE_ENV=development` in production
- ⚠️ The endpoint is documented in Swagger but clearly marked as development-only

## Cleanup

When moving to production:
1. Ensure `NODE_ENV=production` (or remove development mode)
2. The endpoint becomes inaccessible automatically
3. Use normal `/auth/login` flow with proper challenge-response

## Tips

- Use any public key value - it doesn't need to correspond to a real private key
- Each request creates a new identity/session if the public key doesn't exist
- Sessions created via dev-login work exactly like production sessions for testing
- Great for testing protected endpoints in Swagger without client-side crypto setup
