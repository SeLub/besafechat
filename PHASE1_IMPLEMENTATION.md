# Phase 1 Implementation - Profile Features

## ✅ Completed Features

### 1. Profile Image Upload
- **Backend:**
  - Added `avatarUrl` column to `users` table
  - Created `ProfileController` with endpoints:
    - `POST /user/profile/avatar/upload` - Get presigned S3 URL
    - `POST /user/profile/avatar/confirm` - Confirm upload and save to DB
    - `DELETE /user/profile/avatar` - Delete avatar from S3 and DB
  - S3 path structure: `users/{userId}/avatar.{ext}`
  - Supported formats: JPG, PNG, WebP
  - Max file size: 5MB
  - Old avatar deleted immediately on new upload

- **Frontend:**
  - Added file input with camera icon button
  - Image upload flow: Get presigned URL → Upload to S3 → Confirm
  - Avatar displayed in:
    - Profile page (large, 96x96)
    - Hamburger menu (medium, 48x48)
  - Loading state during upload
  - Toast notifications for success/error

### 2. Display Name Editing
- **Backend:**
  - `PATCH /user/profile/display-name` endpoint
  - Validation: 1-24 characters, Unicode support (emoji allowed)
  - Updates `displayName` column in `users` table

- **Frontend:**
  - Created `DisplayNameModal` component
  - Character counter (24 max)
  - Emoji support ✅
  - Real-time validation
  - Updates profile after save

### 3. Phone Field Removed
- ✅ Removed from profile page UI
- ✅ Never existed in database schema

### 4. Public Key Display
- Kept in profile page with Key icon
- Displayed in monospace font
- Collapsible section for better UX

## 📁 Files Created/Modified

### Backend
**Created:**
- `backend/src/domains/user/controllers/profile.controller.ts`
- `backend/src/domains/user/dto/update-display-name.dto.ts`

**Modified:**
- `backend/src/domains/user/user.entity.ts` - Added `avatarUrl` column
- `backend/src/domains/user/user.module.ts` - Registered ProfileController
- `backend/src/domains/user/services/user.service.ts` - Added `updateAvatarUrl()`, `updateDisplayName()`
- `backend/src/domains/user/controllers/auth-session.controller.ts` - Return `avatarUrl` in profile
- `backend/src/domains/storage/storage.service.ts` - Added `getPublicUrl()` method

### Frontend
**Created:**
- `frontend/app/components/display-name-modal.tsx`

**Modified:**
- `frontend/app/components/left-panel-pages.tsx` - Avatar upload, display name edit
- `frontend/app/components/hamburger-menu.tsx` - Show avatar
- `frontend/app/hooks/use-auth.tsx` - Added `avatarUrl` to User interface

### Database
**Migration:**
```sql
ALTER TABLE users ADD COLUMN "avatarUrl" TEXT;
```

## 🔧 API Endpoints

### Profile Management
```
POST   /user/profile/avatar/upload      - Get presigned S3 URL
POST   /user/profile/avatar/confirm     - Confirm avatar upload
DELETE /user/profile/avatar             - Delete avatar
PATCH  /user/profile/display-name       - Update display name
```

### Updated Endpoints
```
GET    /auth/profile                    - Now returns avatarUrl
```

## 🎨 S3 File Structure
```
s3://besafe.bucket/
└── users/
    └── {userId}/
        └── avatar.{jpg|png|webp}
```

## 🧪 Testing

### Test Avatar Upload
```bash
# 1. Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"YOUR_KEY","deviceId":"test"}' \
  -c cookies.txt

# 2. Get upload URL
curl -X POST http://localhost:4000/user/profile/avatar/upload \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"contentType":"image/jpeg"}'

# 3. Upload image to presigned URL (use returned uploadUrl)
curl -X PUT "PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @avatar.jpg

# 4. Confirm upload
curl -X POST http://localhost:4000/user/profile/avatar/confirm \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"fileKey":"users/USER_ID/avatar.jpg"}'

# 5. Check profile
curl -X GET http://localhost:4000/auth/profile -b cookies.txt
```

### Test Display Name
```bash
curl -X PATCH http://localhost:4000/user/profile/display-name \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"displayName":"Sergio Boffon 🔐"}'
```

## 🚀 Next Steps (Phase 2)

### QR Code Contact Sharing
- Replace raw public key with "Share Contact" button
- Generate QR code with contact info
- Deep link support: `besafechat://add-contact?key=...`
- QR scanner for adding contacts

### Additional Profile Features
- Bio field (140 chars)
- Profile visibility settings
- Account statistics
- Recovery phrase viewer

## 📝 Notes

- Avatar URLs are direct S3 URLs (not presigned, permanent)
- Display names support full Unicode (Cyrillic, emoji, etc.)
- Old avatars are deleted immediately on new upload
- File keys stored in DB, public URLs generated on-demand
- Max 5MB file size enforced on backend
- Frontend compresses images before upload (recommended)

## ✅ Validation Rules

### Avatar
- Max size: 5MB
- Formats: image/jpeg, image/png, image/webp
- Recommended: 512x512px

### Display Name
- Length: 1-24 characters
- Unicode: ✅ Allowed
- Emoji: ✅ Allowed
- Unique: ❌ Not required
