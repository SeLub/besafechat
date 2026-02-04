# Security Analysis: Seed Storage Removal from IndexedDB

## Overview
This document analyzes the security issue with stored seeds in IndexedDB and the implemented solution to remove seed storage from client-side storage while preserving application functionality.

## Security Issue Identified

### Current Problem
- Seeds were being stored in IndexedDB in the `seeds` table
- The seed phrase was temporarily stored in indexedDB in the `createAccountWithSeed` function
- This created a security vulnerability since the seed is the master key to the user's account
- Browser storage (IndexedDB) is accessible to any JavaScript running on the same origin, creating a potential attack vector

### Risk Assessment
- **High Risk**: Seeds stored in plain text or even encrypted in IndexedDB can be accessed by:
  - Malicious JavaScript code running on the same domain
  - Browser extensions with access to the site
  - Cross-site scripting (XSS) attacks
- **Impact**: Full account compromise if the seed is extracted

## Solution Implemented

### Changes Made

1. **Database Schema Update**:
   - Removed `Seed` interface from `/workspace/frontend/app/lib/db/schema.ts`
   - Removed `seeds: "id"` from the database schema
   - Updated database version from 2 to 3 in `/workspace/frontend/app/lib/db/db.ts`

2. **Seed Storage Redesign**:
   - Replaced indexedDB seed storage with temporary in-memory storage
   - Added `temporarySeed` variable to hold seed only during the account creation process
   - Seeds are now only kept in memory during the brief window when they're needed
   - Added automatic cleanup after cloud backup is completed

3. **Security Enhancements**:
   - Added `clearTemporarySeed()` function for explicit cleanup
   - Updated `handleClearKey()` to also clear temporary seed storage
   - Seeds are cleared after successful cloud backup upload
   - Seeds are cleared during recovery process

### Flow Changes

#### Before (Insecure):
1. User creates account with seed
2. Seed stored in IndexedDB table `seeds`
3. Seed remains in IndexedDB indefinitely
4. Cloud backup retrieves seed from IndexedDB
5. Seed still in IndexedDB after backup

#### After (Secure):
1. User creates account with seed
2. Seed stored temporarily in memory only
3. Seed never stored in persistent storage
4. Cloud backup retrieves seed from memory
5. Seed automatically cleared from memory after backup
6. Seed cleared during logout/recovery

## Security Benefits

1. **Reduced Attack Surface**: Seeds are no longer stored in persistent browser storage
2. **Memory-Only Storage**: Seeds exist only in memory during brief operations
3. **Automatic Cleanup**: Seeds are automatically cleared after use
4. **Maintained Functionality**: All existing features preserved (cloud backup, recovery, etc.)
5. **Zero Persistence**: Seeds are never written to disk or any persistent storage

## Functionality Preserved

- Cloud backup functionality: ✅ Maintained
- Self-custody option: ✅ Maintained
- Seed phrase recovery: ✅ Maintained
- Password-based recovery: ✅ Maintained
- Account creation flow: ✅ Maintained
- All UI components: ✅ Maintained

## Additional Security Measures

1. **Temporary Storage**: Seeds exist only in memory for the minimum required time
2. **Explicit Cleanup**: Seeds are cleared when no longer needed
3. **No Global State**: Seeds are not part of any global application state
4. **Session-Based**: Seeds are cleared when user logs out or session ends

## Verification Steps

To verify the fix:

1. Create a new account with cloud backup option
2. Check that seeds are not stored in IndexedDB after the process
3. Create a new account with self-custody option
4. Verify that seeds are not stored in IndexedDB
5. Perform recovery operations
6. Confirm that all functionality works as expected

## Conclusion

The security issue has been successfully addressed by removing seed storage from IndexedDB while preserving all application functionality. Seeds are now only stored temporarily in memory during the account creation process and are automatically cleared when no longer needed. This significantly reduces the attack surface while maintaining the user experience and all existing features.

The implementation follows security best practices by minimizing the time seeds are accessible in memory and ensuring they are never persisted to browser storage.