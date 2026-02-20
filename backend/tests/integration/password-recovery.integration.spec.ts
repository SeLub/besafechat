/**
 * @jest-environment node
 */

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid'),
}));

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ClaimedRecoveryPassword } from '../../src/domains/auth/entities/claimed-recovery-password.entity';
import { Identity } from '../../src/domains/identity/identity.entity';
import { RedisService } from '../../src/domains/redis/redis.service';

describe('Password Recovery Integration Tests', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    // Clean up database before each test
    const claimedPasswordsRepo = moduleRef.get(getRepositoryToken(ClaimedRecoveryPassword));
    await claimedPasswordsRepo.query('TRUNCATE TABLE claimed_recovery_passwords CASCADE');

    const identityRepo = moduleRef.get(getRepositoryToken(Identity));
    await identityRepo.query('TRUNCATE TABLE identities CASCADE');

    // Clear Redis rate limit cache for this test
    const redisService = moduleRef.get(RedisService);
    const client = redisService.getClient();
    await client.flushdb();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /password-recovery/check-availability', () => {
    it('should return available: true for unused password hash', async () => {
      const passwordHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const response = await request(app.getHttpServer())
        .post('/password-recovery/check-availability')
        .send({ password_hash: passwordHash })
        .expect(200);

      expect(response.body).toEqual({
        available: true,
        reason: null,
      });
    });

    it('should return available: false for already claimed password hash', async () => {
      const passwordHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      // Add the password hash to the database to simulate an existing claim
      const passwordHashRepo = moduleRef.get(getRepositoryToken(ClaimedRecoveryPassword));
      await passwordHashRepo.save({
        password_hash: passwordHash,
        claimed_at: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/password-recovery/check-availability')
        .send({ password_hash: passwordHash })
        .expect(200);

      expect(response.body).toEqual({
        available: false,
        reason: 'password_already_in_use',
      });
    });

    it('should return 400 for invalid password hash format', async () => {
      const response = await request(app.getHttpServer())
        .post('/password-recovery/check-availability')
        .send({ password_hash: 'tooshort' })
        .expect(400);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /password-recovery/claim', () => {
    it('should successfully claim a new password hash', async () => {
      const passwordHash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

      const response = await request(app.getHttpServer())
        .post('/password-recovery/claim')
        .send({
          password_hash: passwordHash,
          user_agent: 'Test Agent',
        })
        .set('Cookie', ['sessionId=test-session'])
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Password claimed successfully',
      });
    });

    it('should return 409 when trying to claim an already used password hash', async () => {
      const passwordHash = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

      // Add to permanent storage
      const passwordHashRepo = moduleRef.get(getRepositoryToken(ClaimedRecoveryPassword));
      await passwordHashRepo.save({
        password_hash: passwordHash,
        claimed_at: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post('/password-recovery/claim')
        .send({
          password_hash: passwordHash,
          user_agent: 'Test Agent',
        })
        .set('Cookie', ['sessionId=test-session'])
        .expect(409);
      expect(response.body.message).toBe('Password already claimed by another user');
      expect(response.body.code).toBe('PASSWORD_CLAIMED');
    });
  });
});
