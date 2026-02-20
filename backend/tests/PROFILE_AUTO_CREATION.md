# Profile Auto Creation Tests

## Overview

This directory contains tests for the automatic profile creation feature when creating handles. The feature ensures that whenever a user creates an account-type handle, a corresponding profile is automatically created in the same database transaction.

## Tests Structure

### Unit Tests: `unit/handle-profile-auto-creation.spec.ts`

Tests the `HandleService.createHandle()` method in isolation with mocked dependencies.

**Test Cases:**

1. **Auto Profile Creation for Account Type**
   - Verifies that profile is created when creating an account-type handle
   - Ensures profile data (displayName, firstName, lastName, email, settings) is properly stored

2. **No Profile for Team Type**
   - Verifies that creating a team-type handle does NOT create a profile
   - Profile creation is skipped based on handle type

3. **No Profile for Channel Type**
   - Verifies that creating a channel-type handle does NOT create a profile
   - Channel handles manage their own data through Channel entity

4. **Default Display Name**
   - Tests that `profileData` is optional
   - When not provided, profile uses `'Anonym User'` as default displayName
   - Settings default to empty object `{}`

5. **Custom Profile Settings**
   - Tests profile creation with full custom data
   - Verifies all optional fields (firstName, lastName, email, bio, settings) are preserved

### Integration Tests: `integration/handle-profile-auto-creation.spec.ts`

Tests the entire flow with a real NestJS application module (but mocked database).

**Test Cases:**

1. **Create Account Handle with Profile Data**
   - End-to-end test of handle + profile creation
   - Verifies transaction is used for atomicity
   - Validates all profile fields are correctly stored

2. **Create Team Handle Without Profile**
   - Verifies team handles don't trigger profile creation
   - Confirms handle is created successfully

3. **Create Channel Handle Without Profile**
   - Verifies channel handles don't trigger profile creation
   - Confirms handle is created successfully

4. **Default Profile Data**
   - Tests profile creation without explicit profileData parameter
   - Verifies default values are applied

5. **getPrimaryHandle with Profile Loading**
   - Verifies that primary handle queries include profile relation
   - Ensures profile data is available when fetching primary handle

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:int

# Run specific test file
npm test handle-profile-auto-creation.spec.ts

# Run with coverage
npm test -- --coverage
```

## Implementation Details

### Auto-Creation Flow

```
POST /handles (account type)
    ↓
HandleController.createHandle()
    ↓
HandleService.createHandle()
    ↓
dataSource.transaction() {
    1. Check for duplicate handle value
    2. Create Handle entity
    3. If type === 'account':
       - Create Profile entity
       - Set profileData (or defaults)
    4. Save both to DB
}
    ↓
Return Handle (with profile created)
```

### Key Design Decisions

1. **Transaction Safety**: Profile creation is part of the same database transaction as handle creation
   - If profile creation fails, entire operation is rolled back
   - No orphaned handles without profiles

2. **Type-Based Behavior**: Profile creation only for account-type handles
   - Team/Channel profiles are managed by their own entities
   - Keeps design clean and maintainable

3. **Backward Compatibility**: 
   - `profileData` parameter is optional
   - Default values are applied when not provided
   - Existing code continues to work

4. **Profile Relation Loading**:
   - `getPrimaryHandle()` includes profile relation
   - `AuthService.getIdentityProfile()` can access profile directly from handle relation
   - Reduces N+1 query issues

## Test Coverage

- ✅ Account handle with full profile data
- ✅ Account handle with default profile data
- ✅ Team handle without profile
- ✅ Channel handle without profile
- ✅ Profile data preservation (firstName, lastName, email, bio, settings)
- ✅ Transaction atomicity
- ✅ Profile relation loading
- ✅ Error cases (duplicate handle, missing identity)

## Related Code Files

- `src/domains/handle/services/handle.service.ts` - Service implementation
- `src/domains/handle/controllers/handle.controller.ts` - API endpoint
- `src/domains/auth/services/auth.service.ts` - Uses createHandle for registration
- `src/domains/profile/profile.entity.ts` - Profile entity definition
- `src/domains/profile/controllers/profile.controller.ts` - Profile API (PATCH only)

## Notes

- Tests use mocked DataSource for isolation
- No real database required for unit tests
- Integration tests use application-level mocking
- All tests follow Jest/NestJS testing conventions
