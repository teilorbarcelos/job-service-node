import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/shared/utils/logger.js';

// Mock CONFIG
vi.mock('@/shared/config/env.js', () => ({
  CONFIG: {
    REDIS: {
      HOST: 'localhost',
      PORT: 6379,
      PASSWORD: 'pass',
      DB: 0
    }
  }
}));

describe('RedisProvider Unit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
  });

  it('should initialize with host/port configuration', async () => {
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    RedisProvider.instance = null;
    
    RedisProvider.getInstance();
    
    const lastCall = vi.mocked(Redis).mock.calls[0];
    const options = (lastCall as any)[0] as any;
    expect(options).toMatchObject({ host: 'localhost' });
    
    // Cover retryStrategy in this branch
    expect(options.retryStrategy(1)).toBe(50);
    expect(options.retryStrategy(100)).toBe(2000);
  });

  it('should handle missing password in configuration (line 25)', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');
    // Using cast to any because CONFIG is 'as const' in the original file
    (CONFIG.REDIS as any).PASSWORD = ''; 
    
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    RedisProvider.instance = null;
    
    RedisProvider.getInstance();
    
    const lastCall = vi.mocked(Redis).mock.calls[0];
    const options = (lastCall as any)[0] as any;
    expect(options.password).toBeUndefined();
    
    // Reset for next tests
    (CONFIG.REDIS as any).PASSWORD = 'pass';
  });

  it('should initialize with URL configuration', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');
    (CONFIG.REDIS as any).HOST = 'redis://remote:6380';
    
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    RedisProvider.instance = null;
    
    RedisProvider.getInstance();
    
    const lastCall = vi.mocked(Redis).mock.calls[0];
    expect((lastCall as any)[0]).toBe('redis://remote:6380');
    
    // Cover retryStrategy in this branch
    const options = (lastCall as any)[1] as any;
    expect(options.retryStrategy(1)).toBe(50);
    expect(options.retryStrategy(100)).toBe(2000);
  });

  it('should return same instance on second call (singleton - line 10)', async () => {
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    RedisProvider.instance = null;
    
    const instance1 = RedisProvider.getInstance();
    const instance2 = RedisProvider.getInstance();
    
    expect(instance1).toBe(instance2);
    // Redis constructor should only be called once
    expect(Redis).toHaveBeenCalledTimes(1);
  });

  it('should register event listeners', async () => {
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    RedisProvider.instance = null;
    
    const instance = RedisProvider.getInstance();
    
    expect(instance.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(instance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    
    // Trigger listeners to cover console logs
    const errorListener = vi.mocked(instance.on).mock.calls.find((call: any) => call[0] === 'error')![1];
    const connectListener = vi.mocked(instance.on).mock.calls.find((call: any) => call[0] === 'connect')![1];
    
    const errorSpy = vi.spyOn(logger, 'error');
    const infoSpy = vi.spyOn(logger, 'info');
    
    errorListener(new Error('test error'));
    connectListener();
    
    expect(errorSpy).toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalled();
    
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it('should cover the private constructor', async () => {
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    // Calling private constructor for coverage
    const instance = new RedisProvider();
    expect(instance).toBeInstanceOf(RedisProvider);
  });

  afterAll(async () => {
    const { RedisProvider } = await vi.importActual<any>('@/infra/database/RedisProvider.js');
    RedisProvider.instance = null;
    RedisProvider.getInstance();
  });
});
