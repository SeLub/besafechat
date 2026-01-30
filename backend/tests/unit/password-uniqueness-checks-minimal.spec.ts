import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimedRecoveryPassword } from '../../src/domains/auth/entities/claimed-recovery-password.entity';
import { PasswordRecoveryService } from '../../src/domains/auth/services/password-recovery.service';

describe('Password Uniqueness Minimal Tests', () => {
  let service: PasswordRecoveryService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn() as any,
      createQueryBuilder: jest.fn() as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordRecoveryService,
        {
          provide: getRepositoryToken(ClaimedRecoveryPassword),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PasswordRecoveryService>(PasswordRecoveryService);
  });

  it('should return true for available password hash', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    const result = await service.isPasswordHashAvailable(
      'uniquepasswordhash123456789012345678901234567890abcdef1234567890abcdef'
    );
    expect(result).toBe(true);
  });

  it('should return false for already claimed password hash', async () => {
    const mockRecord = {
      password_hash: 'alreadyusedhash123456789012345678901234567890abcdef1234567890abcdef',
      claimed_at: new Date(),
    };
    mockRepository.findOne.mockResolvedValue(mockRecord);

    const result = await service.isPasswordHashAvailable(
      'alreadyusedhash123456789012345678901234567890abcdef1234567890abcdef'
    );
    expect(result).toBe(false);
  });

  it('should successfully claim a new password hash', async () => {
    const mockQueryBuilder = {
      insert: () => mockQueryBuilder,
      into: () => mockQueryBuilder,
      values: () => mockQueryBuilder,
      execute: () => Promise.resolve({ identifiers: [] }),
    };

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const result = await service.claimPasswordHash(
      'newpasswordhash12345678901234567890123456789012345678901234567890'
    );
    expect(result.success).toBe(true);
  });

  it('should return false when trying to claim an already used password hash', async () => {
    const uniqueConstraintError = new Error(
      'duplicate key value violates unique constraint'
    );
    (uniqueConstraintError as any).code = '23505';

    const mockQueryBuilder = {
      insert: () => mockQueryBuilder,
      into: () => mockQueryBuilder,
      values: () => mockQueryBuilder,
      execute: () => Promise.reject(uniqueConstraintError),
    };

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const result = await service.claimPasswordHash(
      'alreadyusedhash12345678901234567890123456789012345678901234567890'
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('already_claimed');
  });

  it('should handle other database errors', async () => {
    const dbError = new Error('database connection failed');

    const mockQueryBuilder = {
      insert: () => mockQueryBuilder,
      into: () => mockQueryBuilder,
      values: () => mockQueryBuilder,
      execute: () => Promise.reject(dbError),
    };

    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const result = await service.claimPasswordHash(
      'testpasswordhash12345678901234567890123456789012345678901234567890'
    );
    expect(result.success).toBe(false);
    expect(result.reason).toBe('database_error');
  });
});
