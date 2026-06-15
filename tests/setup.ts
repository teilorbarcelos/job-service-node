import { vi } from 'vitest';

// Se USE_REAL_DB estiver ativo, não aplicamos os mocks globais para permitir que o Testcontainers funcione

vi.mock('@/shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

const mocks = vi.hoisted(() => {
  const mockRedisObj = {
    get: vi.fn().mockResolvedValue(JSON.stringify({ id: 'test-user', email: 'test@example.com', roleId: 'admin' })),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue(['0', []]),
    status: 'ready',
    on: vi.fn().mockImplementation(function(this: any, event: string, cb: any) {
      if (event === 'connect' || event === 'ready') cb();
      return this;
    }),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn().mockResolvedValue('OK'),
    defineCommand: vi.fn().mockImplementation(function(this: any, name: string) {
      this[name] = vi.fn().mockResolvedValue([0, Date.now() + 1000]);
    }),
    eval: vi.fn().mockResolvedValue([0, Date.now() + 1000]),
    evalsha: vi.fn().mockResolvedValue([0, Date.now() + 1000]),
  };

  const mockPrismaObj = {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn().mockImplementation((cb: any) => cb(mockPrismaObj)),
    user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    role: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    auth: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    feature: { findMany: vi.fn().mockResolvedValue([]) }
  };

  const mockAuditDbObj = {
    audit: { create: vi.fn().mockResolvedValue({}) },
    errorLog: { create: vi.fn().mockResolvedValue({}) }
  };

  class PrismaServiceMock {
    static getMainClient() { return mockPrismaObj; }
    static getAuditClient() { return mockAuditDbObj; }
    static auditInstance = null;
  }

  // Função clássica para garantir comportamento de construtor (new Redis)
  const MockRedisConstructor = vi.fn().mockImplementation(function() {
    return mockRedisObj;
  });

  return {
    mockRedis: mockRedisObj,
    mockPrisma: mockPrismaObj,
    mockAuditDb: mockAuditDbObj,
    PrismaServiceMock,
    MockRedisConstructor,
    mockRedisModule: {
      redis: mockRedisObj,
      RedisProvider: { getInstance: () => mockRedisObj }
    },
    prismaMockModule: {
      db: mockPrismaObj,
      auditDb: mockAuditDbObj,
      PrismaService: PrismaServiceMock
    }
  };
});

// IORedis Mock
vi.mock('ioredis', () => ({
  Redis: mocks.MockRedisConstructor,
  default: mocks.MockRedisConstructor,
}));

vi.mock('@/infra/database/RedisProvider.js', () => mocks.mockRedisModule);
vi.mock('../src/infra/database/RedisProvider.js', () => mocks.mockRedisModule);
vi.mock('../../src/infra/database/RedisProvider.js', () => mocks.mockRedisModule);

vi.mock('@/infra/database/PrismaService.js', () => mocks.prismaMockModule);
vi.mock('../src/infra/database/PrismaService.js', () => mocks.prismaMockModule);
vi.mock('../../src/infra/database/PrismaService.js', () => mocks.prismaMockModule);
vi.mock('./src/infra/database/PrismaService.js', () => mocks.prismaMockModule);
