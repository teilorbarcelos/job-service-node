import { vi } from 'vitest';

vi.mock('@/shared/utils/logger.js', () => {
  const childLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  childLogger.child.mockImplementation(() => childLogger);
  return {
    logger: childLogger,
  };
});

vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(function (this: any) {
    this.ping = vi.fn().mockResolvedValue('PONG');
    this.quit = vi.fn().mockResolvedValue('OK');
    this.on = vi.fn().mockReturnThis();
  });
  return { Redis: RedisMock, default: RedisMock };
});

process.env.NODE_ENV = 'test';
process.env.MESSAGING_ENABLED = 'false';
