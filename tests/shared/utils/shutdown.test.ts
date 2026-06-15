import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, registerShutdownHandlers } from '@/shared/utils/shutdown.js';
import { logger } from '@/shared/utils/logger.js';

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn().mockResolvedValue(undefined),
  redisQuit: vi.fn().mockResolvedValue('OK'),
  prismaClose: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/infra/messaging/RabbitMQProvider.js', () => ({
  messagingProvider: { disconnect: mocks.disconnect },
}));

vi.mock('@/infra/database/RedisProvider.js', () => ({
  RedisProvider: {
    close: vi.fn().mockImplementation(async () => {
      await mocks.redisQuit();
    }),
  },
}));

vi.mock('@/infra/database/PrismaService.js', () => ({
  PrismaService: { close: mocks.prismaClose },
}));

describe('cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve fechar RabbitMQ, Redis e Prisma em ordem', async () => {
    const calls: string[] = [];
    mocks.disconnect.mockImplementation(async () => { calls.push('rabbit'); });
    mocks.redisQuit.mockImplementation(async () => { calls.push('redis'); });
    mocks.prismaClose.mockImplementation(async () => { calls.push('prisma'); });

    await cleanup();

    expect(calls).toEqual(['rabbit', 'redis', 'prisma']);
  });

  it('deve logar progresso de cada etapa', async () => {
    await cleanup();
    const messages = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(messages).toContain('[Shutdown] Stopping job scheduler and closing connections...');
    expect(messages).toContain('[Shutdown] Closing RabbitMQ');
    expect(messages).toContain('[Shutdown] Closing Redis');
    expect(messages).toContain('[Shutdown] Closing Prisma');
    expect(messages).toContain('[Shutdown] Cleanup complete');
  });
});

describe('registerShutdownHandlers', () => {
  let originalExit: typeof process.exit;
  let originalOn: typeof process.on;
  let listeners: Record<string, () => void>;

  beforeEach(() => {
    listeners = {};
    originalExit = process.exit;
    originalOn = process.on;
    process.exit = vi.fn() as unknown as typeof process.exit;
    process.on = vi.fn().mockImplementation(((event: string, fn: () => void) => {
      listeners[event] = fn;
      return process;
    }) as unknown as typeof process.on);
  });

  afterEach(() => {
    process.exit = originalExit;
    process.on = originalOn;
  });

  it('não deve registrar handlers em test mode', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      registerShutdownHandlers(async () => {});
      expect(process.on).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('deve registrar SIGTERM e SIGINT quando não em test', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      registerShutdownHandlers(async () => {});
      expect(listeners.SIGTERM).toBeDefined();
      expect(listeners.SIGINT).toBeDefined();
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('handler deve chamar shutdown e process.exit(0)', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const handler = vi.fn().mockResolvedValue(undefined);
    try {
      registerShutdownHandlers(handler);
      await listeners.SIGTERM();
      expect(handler).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('handler deve chamar process.exit(1) em timeout', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    vi.useFakeTimers();
    try {
      const handler = vi.fn().mockImplementation(() => new Promise(() => {}));
      registerShutdownHandlers(handler);
      listeners.SIGTERM();
      await vi.advanceTimersByTimeAsync(31000);
      expect(process.exit).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
      process.env.NODE_ENV = original;
    }
  });

  it('handler deve tolerar exceção do shutdown', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const handler = vi.fn().mockRejectedValue(new Error('shutdown fail'));
      registerShutdownHandlers(handler);
      await listeners.SIGINT();
      expect(process.exit).toHaveBeenCalledWith(0);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
