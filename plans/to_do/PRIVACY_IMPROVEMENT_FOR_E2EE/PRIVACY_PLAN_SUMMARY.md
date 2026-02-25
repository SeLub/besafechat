# Privacy Architecture Plan - Quick Summary

**Status:** 🎯 PLANNED (Not Yet Implemented)  
**Timeline:** 10-14 days  
**Priority:** P1 - Critical for Privacy

---

## The Problem

Server currently stores **too much metadata** about messages:
- Message type (text, image, video)
- Reactions and pins
- Media-to-chat relationships
- Geolocation data

This violates E2EE principles even though content is encrypted.

---

## The Solution

### Move all semantic data into encrypted payload

**Server sees only:**
```json
{
  "messageId": "uuid",
  "chatId": "uuid",
  "senderHandleId": "uuid",
  "timestamp": 1708400000,
  "encryptedPayload": "<binary blob>",
  "contentHash": "sha256...",
  "isDeleted": false
}
```

**Client decrypts and sees:**
```json
{
  "type": "video",
  "text": "Check this out!",
  "mediaId": "uuid",
  "reactions": ["👍", "❤️"],
  "location": { "lat": 51.5, "lng": -0.1 },
  "replyToMessageId": "uuid"
}
```

---

## Key Changes

### Backend
- ✅ `message_metadata.entity.ts` - Remove all fields except delivery metadata
- ✅ `media.entity.ts` - Remove `chatId` and `messageId` relationships
- ✅ Services - Accept `encryptedPayload` instead of individual fields

### Frontend  
- ✅ IndexedDB - Store full decrypted messages locally
- ✅ Send flow - Encrypt entire message object
- ✅ Receive flow - Decrypt payload and store locally
- ✅ Reactions - Implement as system messages

---

## What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Server knows message type | ✅ Yes | ❌ No |
| Server sees reactions | ✅ Yes | ❌ No |
| Server links media to chat | ✅ Yes | ❌ No |
| Server stores location | ✅ Yes | ❌ No |
| Client has full messages | ❌ No | ✅ Yes |
| Client controls metadata | ❌ No | ✅ Yes |
| E2EE principles followed | ⚠️ Partial | ✅ Full |

---

## Implementation Phases

1. **Phase 1** - Backend entities & services (2-3 days)
2. **Phase 2** - Frontend core messaging (3-4 days)
3. **Phase 3** - Frontend media & features (2-3 days)
4. **Phase 4** - Testing & polish (2-3 days)

**Total:** ~10-14 days

---

## Success Criteria

✅ Server stores NO message content  
✅ Server stores NO message type  
✅ Server stores NO reactions  
✅ Server stores NO media-to-message links  
✅ Client has full local copies of all data  
✅ All features work (reactions, media, threading)  
✅ Performance acceptable  

---

## Status

**Current:** 🎯 PLANNED  
**Next:** Awaiting approval to start Phase 1

**To Start:**
1. Confirm approach is acceptable
2. Backup current database
3. Create feature branch
4. Assign developers

**Full Details:** See PRIVACY_ARCHITECTURE_PLAN.md
