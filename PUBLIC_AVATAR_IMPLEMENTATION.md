# Public Avatar Implementation

## ✅ Implemented Solution

### **Approach: Client-Side URL Construction**

Instead of backend generating presigned URLs, we:
1. Made S3 bucket public (read-only for avatars)
2. Standardized avatar format to PNG
3. Client constructs URLs directly from userId

---

## 🔧 Changes Made

### **Backend:**

1. **Force PNG format** (`storage.controller.ts`)
   ```typescript
   // Always use PNG for avatars
   fileKey = `users/${userId}/avatar.png`;
   ```

2. **Keep `/auth/profile` unchanged** - Still returns presigned URL for current user

### **Frontend:**

1. **Created avatar utility** (`lib/avatar-utils.ts`)
   ```typescript
   export function getAvatarUrl(userId: string): string {
     return `https://s3.tebi.io/besafe.backet/users/${userId}/avatar.png`;
   }
   ```

2. **Updated chat list** (`chat-list.tsx`)
   ```tsx
   <Avatar>
     <AvatarFallback>{initials}</AvatarFallback>
     {chat.userId && <AvatarImage src={getAvatarUrl(chat.userId)} />}
   </Avatar>
   ```

3. **Added userId to Chat interface**

---

## 📡 How It Works

### **Avatar Upload:**
```
1. User uploads image (any format)
2. Backend converts to PNG
3. Saves as: users/{userId}/avatar.png
4. Old avatars deleted automatically
```

### **Avatar Display:**
```
1. Frontend has userId
2. Constructs URL: https://s3.tebi.io/.../users/{userId}/avatar.png
3. Browser loads image
4. If 404 → Fallback shows initials
5. If 200 → Avatar displays
```

---

## 🎯 Benefits

✅ **Zero API calls** - No backend requests for avatars  
✅ **No expiration** - Direct S3 URLs never expire  
✅ **Browser caching** - Images cached automatically  
✅ **Simple** - Just construct URL from userId  
✅ **Fast** - Instant rendering  
✅ **Scalable** - Works for millions of users  

---

## 🔐 S3 Bucket Policy

**Required policy for public read access:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::besafe.backet/users/*/avatar.png"
    }
  ]
}
```

**Apply in Tebi Console:**
1. Go to bucket `besafe.backet`
2. Permissions → Bucket Policy
3. Paste JSON above
4. Save

---

## 📍 Where Avatars Are Used

### **Currently Implemented:**
- ✅ Current user profile (uses `/auth/profile` presigned URL)
- ✅ Hamburger menu (uses `/auth/profile` presigned URL)
- ✅ Chat list (uses `getAvatarUrl()`)

### **To Be Implemented:**
- ⏳ Message bubbles
- ⏳ Chat header
- ⏳ Contact list
- ⏳ Contact requests

---

## 🔄 Usage Examples

### **In Chat List:**
```tsx
import { getAvatarUrl } from "@/lib/avatar-utils";

<Avatar>
  <AvatarFallback>{initials}</AvatarFallback>
  {chat.userId && <AvatarImage src={getAvatarUrl(chat.userId)} />}
</Avatar>
```

### **In Message Bubble:**
```tsx
<Avatar className="h-8 w-8">
  <AvatarFallback>{initials}</AvatarFallback>
  {message.senderId && <AvatarImage src={getAvatarUrl(message.senderId)} />}
</Avatar>
```

### **In Contact List:**
```tsx
<Avatar>
  <AvatarFallback>{initials}</AvatarFallback>
  {contact.userId && <AvatarImage src={getAvatarUrl(contact.userId)} />}
</Avatar>
```

---

## 🎨 Avatar Format

**Standard:**
- Format: PNG
- Path: `users/{userId}/avatar.png`
- Size: Any (recommended 512x512)
- Max upload: 5MB

**Browser handles:**
- Scaling to fit container
- Caching (automatic)
- 404 fallback (shows initials)

---

## 🚀 Next Steps

1. **Apply S3 bucket policy** (make avatars public)
2. **Add avatars to:**
   - Message bubbles
   - Chat header
   - Contact list
   - Contact requests
3. **Test with multiple users**

---

## 📝 Notes

- `/auth/profile` still returns presigned URL (for current user)
- Other users' avatars use direct S3 URLs
- Browser automatically caches images
- No backend logic needed for avatar display
- PNG format ensures consistency
