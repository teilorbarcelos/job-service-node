import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  scheduler: {
    start: vi.fn(),
    stop: vi.fn(),
    listJobs: vi.fn().mockReturnValue([{ name: 'health-check', schedule: '*/1 * * * *', enabled: true, description: 'mock' }]),
    waitForRunningJobs: vi.fn().mockResolvedValue(undefined),
  },
  registerShutdown: vi.fn(),
  cleanup: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
  getClient: vi.fn(),
  getInstance: vi.fn(),
  messagingEnabled: false,
  shutdownHandler: null as null | (() => Promise<void>),
}));

vi.mock('@/jobs/register-jobs.js', () => ({
  registerJobs: () => mocks.scheduler,
}));

vi.mock('@/shared/utils/shutdown.js', () => ({
  cleanup: mocks.cleanup,
  registerShutdownHandlers: mocks.registerShutdown.mockImplementation((handler: () => Promise<void>) => {
    mocks.shutdownHandler = handler;
  }),
}));

vi.mock('@/infra/messaging/RabbitMQProvider.js', () => ({
  messagingProvider: { connect: mocks.connect },
}));

vi.mock('@/infra/database/PrismaService.js', () => ({
  PrismaService: { getClient: mocks.getClient },
}));

vi.mock('@/infra/database/RedisProvider.js', () => ({
  RedisProvider: { getInstance: mocks.getInstance },
}));

vi.mock('@/shared/config/env.js', () => ({
  CONFIG: {
    ENVIRONMENT: 'test',
    PROVIDERS: {
      get MESSAGING() {
        return { get ENABLED() { return mocks.messagingEnabled; } };
      }
    }
  }
}));

describe('buildApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar scheduler e shutdown', async () => {
    const { buildApp } = await import('@/app.js');
    const { scheduler, shutdown } = await buildApp();
    expect(scheduler).toBe(mocks.scheduler);
    expect(typeof shutdown).toBe('function');
  });

  it('shutdown deve esperar jobs, parar e fazer cleanup', async () => {
    const { buildApp } = await import('@/app.js');
    const { shutdown } = await buildApp();
    await shutdown();
    expect(mocks.scheduler.waitForRunningJobs).toHaveBeenCalled();
    expect(mocks.scheduler.stop).toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalled();
  });
});

describe('start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mocks.messagingEnabled = false;
  });

  it('deve inicializar Prisma e Redis', async () => {
    const { start } = await import('@/app.js');
    await start();
    expect(mocks.getClient).toHaveBeenCalled();
    expect(mocks.getInstance).toHaveBeenCalled();
  });

  it('deve iniciar scheduler e listar jobs', async () => {
    const { start } = await import('@/app.js');
    await start();
    expect(mocks.scheduler.start).toHaveBeenCalled();
    expect(mocks.scheduler.listJobs).toHaveBeenCalled();
  });

  it('deve registrar signal handlers', async () => {
    const { start } = await import('@/app.js');
    await start();
    expect(mocks.registerShutdown).toHaveBeenCalled();
  });

  it('shutdown handler deve aguardar jobs, parar scheduler e fazer cleanup', async () => {
    const { start } = await import('@/app.js');
    await start();
    expect(mocks.shutdownHandler).toBeDefined();
    await mocks.shutdownHandler!();
    expect(mocks.scheduler.waitForRunningJobs).toHaveBeenCalled();
    expect(mocks.scheduler.stop).toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalled();
  });

  it('não deve conectar RabbitMQ quando MESSAGING_ENABLED=false', async () => {
    mocks.messagingEnabled = false;
    const { start } = await import('@/app.js');
    await start();
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('deve tolerar erro de conexão com RabbitMQ', async () => {
    mocks.messagingEnabled = true;
    mocks.connect.mockRejectedValueOnce(new Error('rabbit down'));
    const { start } = await import('@/app.js');
    await expect(start()).resolves.toBeDefined();
  });

  it('deve conectar RabbitMQ quando MESSAGING_ENABLED=true', async () => {
    mocks.messagingEnabled = true;
    const { start } = await import('@/app.js');
    await start();
    expect(mocks.connect).toHaveBeenCalled();
  });
});
