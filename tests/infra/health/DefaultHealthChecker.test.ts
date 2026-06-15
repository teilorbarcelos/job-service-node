import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultHealthChecker } from '@/infra/health/DefaultHealthChecker.js';

const mocks = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  ping: vi.fn(),
  check: vi.fn(),
  messagingEnabled: false,
}));

vi.mock('@/infra/database/PrismaService.js', () => ({
  PrismaService: { getClient: () => ({ $queryRaw: mocks.$queryRaw }) },
}));

vi.mock('@/infra/database/RedisProvider.js', () => ({
  RedisProvider: { getInstance: () => ({ ping: mocks.ping }) },
}));

vi.mock('@/infra/messaging/RabbitMQProvider.js', () => ({
  messagingProvider: { check: mocks.check },
}));

vi.mock('@/shared/config/env.js', () => ({
  CONFIG: {
    PROVIDERS: {
      get MESSAGING() {
        return { get ENABLED() { return mocks.messagingEnabled; } };
      }
    }
  }
}));

describe('DefaultHealthChecker', () => {
  let checker: DefaultHealthChecker;
  let signal: AbortSignal;

  beforeEach(() => {
    vi.clearAllMocks();
    checker = new DefaultHealthChecker();
    signal = new AbortController().signal;
    mocks.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mocks.ping.mockResolvedValue('PONG');
    mocks.check.mockReturnValue(true);
    mocks.messagingEnabled = false;
  });

  afterEach(() => {
    mocks.messagingEnabled = false;
  });

  describe('checkPostgres', () => {
    it('deve retornar up com latency', async () => {
      const result = await checker.checkPostgres(signal);
      expect(result.status).toBe('up');
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('deve retornar down quando Prisma lança', async () => {
      mocks.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const result = await checker.checkPostgres(signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('connection refused');
    });

    it('deve retornar down quando Prisma lança valor não-Error', async () => {
      mocks.$queryRaw.mockRejectedValueOnce('weird');
      const result = await checker.checkPostgres(signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('weird');
    });

    it('deve retornar down quando AbortSignal já abortado', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await checker.checkPostgres(controller.signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('This operation was aborted');
    });
  });

  describe('checkRedis', () => {
    it('deve retornar up quando PONG', async () => {
      const result = await checker.checkRedis(signal);
      expect(result.status).toBe('up');
      expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it('deve retornar down quando resposta não é PONG', async () => {
      mocks.ping.mockResolvedValueOnce('NOPE');
      const result = await checker.checkRedis(signal);
      expect(result.status).toBe('down');
    });

    it('deve retornar down quando Redis lança', async () => {
      mocks.ping.mockRejectedValueOnce(new Error('redis down'));
      const result = await checker.checkRedis(signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('redis down');
    });

    it('deve retornar down quando Redis lança valor não-Error', async () => {
      mocks.ping.mockRejectedValueOnce('weird-redis');
      const result = await checker.checkRedis(signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('weird-redis');
    });

    it('deve retornar down quando AbortSignal já abortado', async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await checker.checkRedis(controller.signal);
      expect(result.status).toBe('down');
    });
  });

  describe('checkRabbitMQ', () => {
    it('deve retornar disabled quando MESSAGING_ENABLED=false', async () => {
      const result = await checker.checkRabbitMQ(signal);
      expect(result.status).toBe('disabled');
    });

    it('deve retornar up quando conectado e MESSAGING_ENABLED=true', async () => {
      mocks.messagingEnabled = true;
      const result = await checker.checkRabbitMQ(signal);
      expect(result.status).toBe('up');
    });

    it('deve retornar down quando desconectado', async () => {
      mocks.messagingEnabled = true;
      mocks.check.mockReturnValueOnce(false);
      const result = await checker.checkRabbitMQ(signal);
      expect(result.status).toBe('down');
    });

    it('deve retornar down quando check lança', async () => {
      mocks.messagingEnabled = true;
      mocks.check.mockImplementationOnce(() => { throw new Error('rabbit down'); });
      const result = await checker.checkRabbitMQ(signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('rabbit down');
    });

    it('deve retornar down quando check lança valor não-Error', async () => {
      mocks.messagingEnabled = true;
      mocks.check.mockImplementationOnce(() => { throw 'string'; });
      const result = await checker.checkRabbitMQ(signal);
      expect(result.status).toBe('down');
      expect(result.error).toBe('string');
    });

    it('deve retornar down quando AbortSignal já abortado', async () => {
      const controller = new AbortController();
      controller.abort();
      mocks.messagingEnabled = true;
      const result = await checker.checkRabbitMQ(controller.signal);
      expect(result.status).toBe('down');
    });
  });
});
