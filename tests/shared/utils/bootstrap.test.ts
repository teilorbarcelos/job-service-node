import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bootstrapSystem } from '@/shared/utils/bootstrap.js';
import { logger } from '@/shared/utils/logger.js';

const { mockPrisma, mockConfig } = vi.hoisted(() => {
  const config = {
    FIRST_USER: 'admin@test.com',
    FIRST_PASSWORD: 'password123',
    DATABASE: {
      URL: 'postgresql://localhost:5432'
    }
  };
  return {
    mockPrisma: {
      user: {
        findUnique: vi.fn(),
      },
      auth: {
        create: vi.fn(),
        upsert: vi.fn(),
      },
      $disconnect: vi.fn(),
    },
    mockConfig: config
  };
});

vi.mock('pg', () => {
  return {
    Pool: vi.fn().mockImplementation(function() {
      return {
        on: vi.fn(),
        end: vi.fn(),
        query: vi.fn(),
      };
    })
  };
});

vi.mock('@prisma/adapter-pg', () => {
  return {
    PrismaPg: vi.fn().mockImplementation(function() {
      return {};
    })
  };
});

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn().mockImplementation(function() {
      return mockPrisma;
    })
  };
});

vi.mock('@/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock('../../src/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/shared/config/env.js', () => ({
  CONFIG: mockConfig
}));
// Vitest intercepta a string exata do import na implementação
vi.mock('../config/env.js', () => ({
  CONFIG: mockConfig
}));

describe('Bootstrap Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.FIRST_USER = 'admin@test.com';
    mockConfig.FIRST_PASSWORD = 'password123';
  });

  it('should sync password if admin already exists', async () => {
    const logSpy = vi.spyOn(logger, 'info');
    mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'admin@test.com' });
    mockPrisma.auth.upsert.mockResolvedValue({ id: '1' });

    await bootstrapSystem();

    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ email: 'admin@test.com' }), expect.stringContaining('O usuário mestre já existe'));
    expect(mockPrisma.auth.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('should create admin and auth if not exists', async () => {
    const logSpy = vi.spyOn(logger, 'info');
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.auth.create.mockResolvedValue({ id: '1' });

    await bootstrapSystem();

    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ email: 'admin@test.com' }), expect.stringContaining('Criando o primeiro usuário mestre'));
    expect(mockPrisma.auth.create).toHaveBeenCalled();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('should log error if bootstrap fails', async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error('DB Error'));
    const spy = vi.spyOn(logger, 'error');

    await bootstrapSystem();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.stringContaining('Falha ao injetar o usuário inicial'));
    spy.mockRestore();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
  });

  it('should return early if email or password missing', async () => {
    mockConfig.FIRST_USER = '';
    await bootstrapSystem();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
