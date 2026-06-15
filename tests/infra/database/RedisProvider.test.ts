import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisProvider } from '@/infra/database/RedisProvider.js';
import { Redis } from 'ioredis';

describe('RedisProvider', () => {
  beforeEach(() => {
    RedisProvider.reset();
    vi.clearAllMocks();
  });

  it('deve retornar singleton', () => {
    const a = RedisProvider.getInstance();
    const b = RedisProvider.getInstance();
    expect(a).toBe(b);
  });

  it('deve usar URL quando REDIS_HOST começa com redis://', () => {
    const original = process.env.REDIS_HOST;
    process.env.REDIS_HOST = 'redis://example.com:6379';
    try {
      RedisProvider.getInstance();
      expect(Redis).toHaveBeenCalledWith('redis://example.com:6379', expect.any(Object));
    } finally {
      if (original === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = original;
    }
  });

  it('deve usar URL quando REDIS_HOST começa com rediss://', () => {
    const original = process.env.REDIS_HOST;
    process.env.REDIS_HOST = 'rediss://secure.example.com:6379';
    try {
      RedisProvider.getInstance();
      expect(Redis).toHaveBeenCalledWith('rediss://secure.example.com:6379', expect.any(Object));
    } finally {
      if (original === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = original;
    }
  });

  it('deve usar host/port quando REDIS_HOST não é URL', () => {
    const originalHost = process.env.REDIS_HOST;
    const originalPort = process.env.REDIS_PORT;
    const originalPassword = process.env.REDIS_PASSWORD;
    const originalDb = process.env.REDIS_DB;
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'secret';
    process.env.REDIS_DB = '3';
    try {
      RedisProvider.getInstance();
      const call = (Redis as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
      const arg = call[0] as { retryStrategy: (times: number) => number; host: string; port: number };
      expect(arg).toEqual(
        expect.objectContaining({ host: '127.0.0.1', port: 6380, password: 'secret', db: 3 })
      );
      // Cobre o corpo de retryStrategy (spread no mesmo objeto)
      expect(arg.retryStrategy(1)).toBe(50);
      expect(arg.retryStrategy(100)).toBe(2000);
    } finally {
      if (originalHost === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = originalHost;
      if (originalPort === undefined) delete process.env.REDIS_PORT;
      else process.env.REDIS_PORT = originalPort;
      if (originalPassword === undefined) delete process.env.REDIS_PASSWORD;
      else process.env.REDIS_PASSWORD = originalPassword;
      if (originalDb === undefined) delete process.env.REDIS_DB;
      else process.env.REDIS_DB = originalDb;
    }
  });

  it('deve registrar listeners de error e connect que logam', () => {
    const instance = RedisProvider.getInstance() as unknown as {
      on: ReturnType<typeof vi.fn>;
    };
    const events = instance.on.mock.calls.map(c => c[0]);
    expect(events).toContain('error');
    expect(events).toContain('connect');

    const errorHandler = instance.on.mock.calls.find(c => c[0] === 'error')?.[1] as (err: Error) => void;
    const connectHandler = instance.on.mock.calls.find(c => c[0] === 'connect')?.[1] as () => void;
    expect(errorHandler).toBeDefined();
    expect(connectHandler).toBeDefined();
    errorHandler(new Error('boom'));
    connectHandler();
  });

  it('deve fechar instância via close', async () => {
    RedisProvider.getInstance();
    await expect(RedisProvider.close()).resolves.not.toThrow();
    expect(RedisProvider.getInstance()).toBeDefined();
  });

  it('close deve logar erro quando quit falha', async () => {
    const instance = RedisProvider.getInstance() as unknown as { quit: ReturnType<typeof vi.fn> };
    instance.quit.mockRejectedValueOnce(new Error('quit fail'));
    await expect(RedisProvider.close()).resolves.not.toThrow();
  });
});
