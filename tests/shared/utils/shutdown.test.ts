import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, registerShutdownHandlers } from '@/shared/utils/shutdown.js';
import { PrismaService } from '@/infra/database/PrismaService.js';
import { redis } from '@/infra/database/RedisProvider.js';
import { messagingProvider } from '@/infra/messaging/RabbitMQProvider.js';
import { logger } from '@/shared/utils/logger.js';

describe('cleanup()', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('should close Prisma pools, Redis and RabbitMQ successfully', async () => {
    PrismaService.mainPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    PrismaService.auditPool = { end: vi.fn().mockResolvedValue(undefined) } as any;

    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    await cleanup();

    // @ts-expect-error — set just above, TS doesn't track assignment across module boundaries
    expect(PrismaService.mainPool.end).toHaveBeenCalled();
    // @ts-expect-error — same reason
    expect(PrismaService.auditPool.end).toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalled();
    expect(messagingProvider.disconnect).toHaveBeenCalled();
  });

  it('should flush audit buffer before closing Prisma', async () => {
    const logSpy = vi.spyOn(logger, 'info');

    await cleanup();

    expect(logSpy).toHaveBeenCalledWith('[Shutdown] Flushing audit buffer...');
    logSpy.mockRestore();
  });

  it('should handle null Prisma pools gracefully', async () => {
    PrismaService.mainPool = null;
    PrismaService.auditPool = null;

    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    await expect(cleanup()).resolves.toBeUndefined();
  });

  it('should log error when Prisma main pool end throws', async () => {
    PrismaService.mainPool = { end: vi.fn().mockRejectedValue(new Error('main pool error')) } as any;
    PrismaService.auditPool = { end: vi.fn().mockResolvedValue(undefined) } as any;

    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    const errorSpy = vi.spyOn(logger, 'error');

    await cleanup();

    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[Shutdown] Error closing main pool');
  });

  it('should log error when Prisma audit pool end throws', async () => {
    PrismaService.mainPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    PrismaService.auditPool = { end: vi.fn().mockRejectedValue(new Error('audit pool error')) } as any;

    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    const errorSpy = vi.spyOn(logger, 'error');

    await cleanup();

    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[Shutdown] Error closing audit pool');
  });

  it('should log error when Redis quit throws', async () => {
    PrismaService.mainPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    PrismaService.auditPool = { end: vi.fn().mockResolvedValue(undefined) } as any;

    vi.spyOn(redis, 'quit').mockRejectedValue(new Error('redis error'));
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    const errorSpy = vi.spyOn(logger, 'error');

    await cleanup();

    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[Shutdown] Error closing Redis');
  });

  it('should log error when RabbitMQ disconnect throws', async () => {
    PrismaService.mainPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    PrismaService.auditPool = { end: vi.fn().mockResolvedValue(undefined) } as any;

    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockRejectedValue(new Error('rabbit error'));

    const errorSpy = vi.spyOn(logger, 'error');

    await cleanup();

    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[Shutdown] Error closing RabbitMQ');
  });

  it('should log progress messages', async () => {
    PrismaService.mainPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    PrismaService.auditPool = { end: vi.fn().mockResolvedValue(undefined) } as any;

    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    const logSpy = vi.spyOn(logger, 'info');

    await cleanup();

    expect(logSpy).toHaveBeenCalledWith('[Shutdown] Closing Prisma connections...');
    expect(logSpy).toHaveBeenCalledWith('[Shutdown] Closing Redis...');
    expect(logSpy).toHaveBeenCalledWith('[Shutdown] Closing RabbitMQ...');
    expect(logSpy).toHaveBeenCalledWith('[Shutdown] Cleanup complete.');
  });
});

describe('registerShutdownHandlers()', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('should trigger cleanup through onClose hook when app closes', async () => {
    PrismaService.mainPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    PrismaService.auditPool = { end: vi.fn().mockResolvedValue(undefined) } as any;
    vi.spyOn(redis, 'quit').mockResolvedValue('OK');
    vi.spyOn(messagingProvider, 'disconnect').mockResolvedValue(undefined);

    const { default: Fastify } = await import('fastify');
    const app = Fastify({ logger: false });
    registerShutdownHandlers(app);
    await app.ready();
    await app.close();

    // @ts-expect-error — set just above, TS doesn't track assignment across module boundaries
    expect(PrismaService.mainPool.end).toHaveBeenCalled();
    // @ts-expect-error — same reason
    expect(PrismaService.auditPool.end).toHaveBeenCalled();
    expect(redis.quit).toHaveBeenCalled();
    expect(messagingProvider.disconnect).toHaveBeenCalled();
  });

  it('should NOT register signal handlers when NODE_ENV=test', () => {
    const processOnSpy = vi.spyOn(process, 'on');
    const mockApp = { addHook: vi.fn() } as any;

    registerShutdownHandlers(mockApp);

    expect(processOnSpy).not.toHaveBeenCalled();
  });

  it('should register signal handlers when NODE_ENV is not test', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockApp = {
      addHook: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.useFakeTimers();

    registerShutdownHandlers(mockApp as any);

    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    vi.useRealTimers();
    vi.unstubAllEnvs();
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('signal handler should call app.close and exit with 0 on success', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockApp = {
      addHook: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    vi.useFakeTimers();

    registerShutdownHandlers(mockApp as any);

    const handlers = processOnSpy.mock.calls.filter(
      call => call[0] === 'SIGTERM' || call[0] === 'SIGINT',
    );

    for (const [, handler] of handlers) {
      await (handler as (signal: string) => Promise<void>)('SIGTERM');
    }

    expect(mockApp.close).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);

    vi.useRealTimers();
    vi.unstubAllEnvs();
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('signal handler should log error when app.close throws and still exit with 0', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const errorSpy = vi.spyOn(logger, 'error');
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockApp = {
      addHook: vi.fn(),
      close: vi.fn().mockRejectedValue(new Error('close failed')),
    };

    vi.useFakeTimers();

    registerShutdownHandlers(mockApp as any);

    const handlers = processOnSpy.mock.calls.filter(
      call => call[0] === 'SIGTERM' || call[0] === 'SIGINT',
    );

    for (const [, handler] of handlers) {
      await (handler as (signal: string) => Promise<void>)('SIGTERM');
    }

    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[Shutdown] Error during shutdown');
    expect(processExitSpy).toHaveBeenCalledWith(0);

    vi.useRealTimers();
    vi.unstubAllEnvs();
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should call process.on for both SIGTERM and SIGINT', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const mockApp = { addHook: vi.fn() } as any;

    registerShutdownHandlers(mockApp as any);

    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

    vi.unstubAllEnvs();
    processOnSpy.mockRestore();
  });

  it('signal handler should force exit with 1 when timeout expires', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const mockApp = {
      addHook: vi.fn(),
      close: vi.fn().mockImplementation(() => new Promise(() => {})),
    };

    vi.useFakeTimers();

    registerShutdownHandlers(mockApp as any);

    const handlers = processOnSpy.mock.calls.filter(
      call => call[0] === 'SIGTERM' || call[0] === 'SIGINT',
    );

    const signalPromise = (handlers[0][1] as (signal: string) => Promise<void>)('SIGTERM');

    vi.advanceTimersByTime(30000);

    await vi.waitFor(() => {
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    vi.useRealTimers();
    vi.unstubAllEnvs();
    processOnSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});
