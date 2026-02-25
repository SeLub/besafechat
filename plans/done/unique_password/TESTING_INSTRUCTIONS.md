# Testing Instructions for Password Recovery System

This document explains how to run the tests for the password recovery system with unique password enforcement.

## Running Backend Tests

To run the backend unit tests for the password recovery service:

```bash
cd backend
npm run test:unit password-recovery
```

Or to run all backend tests:

```bash
cd backend
npm run test
```

## Running Frontend Tests

To run the frontend unit tests for the password recovery service:

```bash
cd frontend
npm run test:unit password-recovery
```

Or to run all frontend tests:

```bash
cd frontend
npm run test
```

## Specific Test Files

The following test files were created for the password recovery functionality:

### Backend Tests

- `backend/tests/unit/password-recovery.service.spec.ts` - Tests for the password recovery service logic

### Frontend Tests

- `frontend/tests/unit/password-recovery.service.spec.ts` - Tests for the frontend password recovery service
- `frontend/tests/unit/account-service-password-recovery.spec.ts` - Tests for account creation with password uniqueness

## Test Coverage

The tests cover:

1. **Password Uniqueness Enforcement**:
   - Checking that identical passwords result in the same storage path
   - Verifying that the system prevents duplicate password usage
   - Testing the atomic operations that ensure race-condition safety

2. **Recovery Flow**:
   - Password availability checking
   - Password claiming functionality
   - Error handling for already-used passwords
   - Network error handling

3. **Integration Points**:
   - Account creation with cloud recovery
   - Proper rejection of accounts with duplicate passwords
   - Successful account creation with unique passwords

## Running Individual Test Files

To run a specific test file:

```bash
# Backend
npx jest src/tests/unit/password-recovery.service.spec.ts

# Frontend
npx jest tests/unit/password-recovery.service.spec.ts
```

## Test Environment Requirements

- Node.js 18+
- npm or yarn package manager
- Jest testing framework (already configured in the project)

## Expected Output

When running the tests, you should see output similar to:

```
PASS  src/tests/unit/password-recovery.service.spec.ts
  PasswordRecoveryService
    ✓ should compute password hash correctly (5 ms)
    ✓ should check password availability successfully (10 ms)
    ✓ should handle claim password successfully (8 ms)
    ✓ should handle already claimed password (6 ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

The tests validate that the password uniqueness system works correctly and prevents the collision issue where users with the same password would have their encrypted seeds stored at the same S3 location.
