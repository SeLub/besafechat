// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

// Jest globals declaration
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaimedRecoveryPassword } from '../../src/domains/auth/entities/claimed-recovery-password.entity';
import { PasswordRecoveryService } from '../../src/domains/auth/services/password-recovery.service';

describe('PasswordRecoveryService', () => {
  let service: PasswordRecoveryService;
  let mockRepository: Repository<ClaimedRecoveryPassword>;

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

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

  describe('isPasswordHashAvailable', () => {
    it('should return true when password hash is not claimed', async () => {
      jest.spyOn(mockRepository, 'findOne').mockResolvedValue(null);

      const result = await service.isPasswordHashAvailable('testpassword123');
      expect(result).toBe(true);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { password_hash: 'testpassword123' },
        select: ['password_hash'],
      });
    });

    it('should return false when password hash is already claimed', async () => {
      const mockRecord = { password_hash: 'alreadyused' } as ClaimedRecoveryPassword;
      jest.spyOn(mockRepository, 'findOne').mockResolvedValue(mockRecord);

      const result = await service.isPasswordHashAvailable('alreadyused');
      expect(result).toBe(false);
    });
  });

  describe('claimPasswordHash', () => {
    it('should successfully claim a password hash when not already claimed', async () => {
      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ identifiers: [] } as any),
      };

      jest.spyOn(mockRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.claimPasswordHash('newpassword');
      expect(result.success).toBe(true);
    });

    it('should return false when password hash is already claimed (unique constraint violation)', async () => {
      const uniqueError = { code: '23505' } as any;

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(uniqueError),
      };

      jest.spyOn(mockRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.claimPasswordHash('alreadyclaimed');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_claimed');
    });

    it('should return false for other database errors', async () => {
      const dbError = new Error('Database error');

      const mockQueryBuilder = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(dbError),
      };

      jest.spyOn(mockRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.claimPasswordHash('errorpassword');
      expect(result.success).toBe(false);
      expect(result.reason).toBe('database_error');
    });
  });
});
