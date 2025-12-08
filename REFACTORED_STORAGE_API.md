# Refactored Storage & Profile API

## ✅ Changes Made

### **1. Removed `avatarUrl` from Database**
- Dropped column from `users` table
- Avatar location is now deterministic: `users/{userId}/avatar.{ext}`
- No DB writes needed for avatar uploads

### **2. Unified Storage Endpoints**
```
POST   /storage/upload          # Get presigned URL for any file
GET    /storage/download/:key   # Get presigned download URL  
DELETE /storage/:key             # Delete any file
```

### **3. Simplified Profile Endpoints**
```
GET    /auth/profile            # Get profile (checks S3 for avatar)
PATCH  /profile/display-name    # Update display name
```

---

## 📡 API Usage

### **Upload Avatar**
```bash
# 1. Get presigned URL
curl -X POST http://localhost:4000/storage/upload \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fileType": "avatar",
    "contentType": "image/png"
  }'

# Response:
{
  "uploadUrl": "https://s3.tebi.io/...",
  "fileKey": "users/89818c02.../avatar.png"
}

# 2. Upload to S3
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/png" \
  --data-binary @avatar.png

# 3. Done! No confirmation needed
```

### **Get Profile (with Avatar)**
```bash
curl -X GET http://localhost:4000/auth/profile -b cookies.txt

# Response:
{
  "id": "89818c02-d096-4b88-b899-b1293a5ca6ea",
  "publicKey": "eRYDMybUH5yzWtuLA8Rn1QZY...",
  "displayName": "Sergey Lubimov",
  "username": "sergio",
  "avatarUrl": "https://s3.tebi.io/...?X-Amz-Signature=..."
}
```

### **Update Display Name**
```bash
curl -X PATCH http://localhost:4000/profile/display-name \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"displayName":"Sergey 🔐"}'
```

### **Upload Chat Image**
```bash
curl -X POST http://localhost:4000/storage/upload \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fileType": "image",
    "contentType": "image/jpeg",
    "filename": "photo.jpg"
  }'

# Response:
{
  "uploadUrl": "https://s3.tebi.io/...",
  "fileKey": "users/89818c02.../media/1234567890-photo.jpg"
}
```

### **Delete File**
```bash
curl -X DELETE http://localhost:4000/storage/users/89818c02.../avatar.png \
  -b cookies.txt
```

---

## 🗂️ S3 File Structure

```
s3://besafe.backet/
└── users/
    └── {userId}/
        ├── avatar.{png|jpg|webp}           # Profile picture
        ├── media/
        │   ├── 1234567890-photo.jpg        # Chat images
        │   ├── 1234567891-video.mp4        # Chat videos
        │   └── 1234567892-voice.ogg        # Voice messages
        └── documents/
            └── report.pdf                   # Shared documents
```

---

## 🔄 How Avatar Detection Works

**Backend logic in `/auth/profile`:**
```typescript
// Try common extensions
const extensions = ['png', 'jpg', 'jpeg', 'webp'];

for (const ext of extensions) {
  const key = `users/${userId}/avatar.${ext}`;
  try {
    avatarUrl = await storageService.getPresignedUrlForDownload(key);
    break; // Found it!
  } catch {
    // File doesn't exist, try next
  }
}
```

**Result:**
- If avatar exists → Returns presigned URL
- If no avatar → Returns `null`
- No DB queries needed!

---

## 📦 Files Changed

### Backend
**Created:**
- `backend/src/domains/storage/dto/upload.dto.ts`
- `backend/src/domains/storage/controllers/storage.controller.ts`

**Modified:**
- `backend/src/domains/user/user.entity.ts` - Removed `avatarUrl`
- `backend/src/domains/user/services/user.service.ts` - Removed `updateAvatarUrl()`
- `backend/src/domains/user/controllers/auth-session.controller.ts` - Avatar detection logic
- `backend/src/domains/user/controllers/profile.controller.ts` - Only display name now
- `backend/src/domains/storage/storage.module.ts` - Registered StorageController

### Frontend
**Modified:**
- `frontend/app/components/left-panel-pages.tsx` - Use `/storage/upload`
- `frontend/app/components/display-name-modal.tsx` - Use `/profile/display-name`

### Database
```sql
ALTER TABLE users DROP COLUMN "avatarUrl";
```

---

## ✅ Benefits

1. **No DB writes for media** - Files are self-describing by path
2. **Unified API** - One endpoint for all file types
3. **Scalable** - Easy to add new media types
4. **RESTful** - Standard CRUD operations
5. **Secure** - User can only delete their own files
6. **Simple** - No confirmation endpoints needed

---

## 🚀 Future Media Types

### Voice Messages
```json
{
  "fileType": "audio",
  "contentType": "audio/ogg",
  "filename": "voice-message.ogg"
}
```

### Documents
```json
{
  "fileType": "document",
  "contentType": "application/pdf",
  "filename": "contract.pdf"
}
```

### Videos
```json
{
  "fileType": "video",
  "contentType": "video/mp4",
  "filename": "clip.mp4"
}
```

All use the same `/storage/upload` endpoint! 🎉
