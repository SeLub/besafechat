// /home/selub/Documents/progs/besafechat/backend/tests/unit/identity-cleanup.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IdentityCleanupService } from '../../src/domains/identity/services/identity-cleanup.service';
import { Identity } from '../../src/domains/identity/identity.entity';
import { Handle } from '../../src/domains/handle/handle.entity';
import { Profile } from '../../src/domains/profile/profile.entity';
import { Chat } from '../../src/domains/chat/chat.entity';
import { Channel } from '../../src/domains/channel/channel.entity';
import { ContactRequest } from '../../src/domains/contact/contact-request.entity';
import { Media } from '../../src/domains/media/media.entity';
import { MessageMetadata } from '../../src/domains/message/message-metadata.entity';
import { Team } from '../../src/domains/team/team.entity';
import { MediaService } from '../../src/domains/media/media.service';
import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// Моки для зависимостей
const mockMediaService = {
  deleteFile: jest.fn().mockResolvedValue(undefined),
};

const mockIdentityRepo = {
  find: jest.fn(),
  delete: jest.fn(),
};

const mockMediaRepo = {
  find: jest.fn(),
  delete: jest.fn(),
};

// Универсальный мок для остальных репозиториев
const mockRepo = {
  find: jest.fn(),
  delete: jest.fn(),
  restore: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    find: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('IdentityCleanupService (Unit)', () => {
  let service: IdentityCleanupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityCleanupService,
        {
          provide: getRepositoryToken(Identity),
          useValue: mockIdentityRepo,
        },
        {
          provide: getRepositoryToken(Media),
          useValue: mockMediaRepo,
        },
        // Статические импорты вместо require()
        { provide: getRepositoryToken(Handle), useValue: mockRepo },
        { provide: getRepositoryToken(Profile), useValue: mockRepo },
        { provide: getRepositoryToken(Chat), useValue: mockRepo },
        { provide: getRepositoryToken(Channel), useValue: mockRepo },
        { provide: getRepositoryToken(ContactRequest), useValue: mockRepo },
        { provide: getRepositoryToken(MessageMetadata), useValue: mockRepo },
        { provide: getRepositoryToken(Team), useValue: mockRepo },
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<IdentityCleanupService>(IdentityCleanupService);

    // Отключаем логирование во время тестов
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with all dependencies', () => {
    expect(service).toBeInstanceOf(IdentityCleanupService);
    // Проверка что моки внедрены (косвенная)
    expect(mockDataSource.createQueryRunner).not.toHaveBeenCalled(); // Вызывается только при работе
  });
});
