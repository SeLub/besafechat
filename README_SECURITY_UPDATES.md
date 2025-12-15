# Security Updates: Seed Storage Improvements

## Security Enhancement Summary

This update addresses a critical security issue where seed phrases were being stored in browser IndexedDB, creating a potential attack vector. The fix removes all persistent storage of seed phrases while maintaining full functionality.

## Security Issue Fixed

**Issue**: Seeds were stored in IndexedDB, making them accessible to malicious JavaScript, browser extensions, or XSS attacks.

**Risk Level**: High

**Fix**: Seeds are now only stored temporarily in memory during the brief account creation process and are automatically cleared when no longer needed.

## Changes Made

1. **Database Schema**: Removed the `seeds` table from IndexedDB schema
2. **Storage Method**: Seeds now stored only in memory during operations
3. **Automatic Cleanup**: Seeds automatically cleared after cloud backup
4. **Explicit Cleanup**: Added manual cleanup functions for security
5. **Session Management**: Seeds cleared on logout and session end

## Functionality Preserved

✅ Cloud backup functionality  
✅ Self-custody option  
✅ Seed phrase recovery  
✅ Password-based recovery  
✅ Account creation flow  
✅ All existing UI components  
✅ S3 encrypted backup storage  

## Security Benefits

- **No Persistent Storage**: Seeds never stored in IndexedDB or browser storage
- **Memory-Only**: Seeds exist only in memory for minimum required time
- **Automatic Cleanup**: Seeds cleared automatically after use
- **Reduced Attack Surface**: Eliminates indexedDB as attack vector
- **Zero Persistence**: Seeds never written to disk

## Verification

All changes have been implemented and tested to ensure:
- No seeds are stored in IndexedDB
- All existing functionality works as expected
- Security is significantly improved
- User experience remains unchanged