import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('env config', () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('deve aplicar defaults quando env está vazio', async () => {
    delete process.env.LOG_LEVEL;
    delete process.env.ENVIRONMENT;
    delete process.env.SHUTDOWN_TIMEOUT_MS;
    delete process.env.JOB_EXECUTION_TIMEOUT_MS;
    delete process.env.MESSAGING_ENABLED;
    delete process.env.HEALTH_CHECK_CRON;
    delete process.env.HEALTH_CHECK_ENABLED;

    const envModule = await import('@/shared/config/env.js');
    expect(envModule.CONFIG.LOG_LEVEL).toBe('info');
    expect(envModule.CONFIG.ENVIRONMENT).toBe('local');
    expect(envModule.CONFIG.SHUTDOWN_TIMEOUT_MS).toBe(30000);
    expect(envModule.CONFIG.JOB_EXECUTION_TIMEOUT_MS).toBe(300000);
    expect(envModule.CONFIG.PROVIDERS.MESSAGING.ENABLED).toBe(false);
    expect(envModule.CONFIG.JOBS.HEALTH_CHECK_CRON).toBe('*/1 * * * *');
    expect(envModule.CONFIG.JOBS.HEALTH_CHECK_ENABLED).toBe(true);
  });

  it('env() deve retornar process.env[key] ou fallback', async () => {
    const envModule = await import('@/shared/config/env.js');
    process.env.MY_TEST = 'hello';
    expect(envModule.env('MY_TEST')).toBe('hello');
    expect(envModule.env('NOT_SET', 'fb')).toBe('fb');
    delete process.env.MY_TEST;
  });

  it('envNumber deve fazer coerce de string para number', async () => {
    const envModule = await import('@/shared/config/env.js');
    process.env.X = '42';
    expect(envModule.envNumber('X', 0)).toBe(42);
    expect(envModule.envNumber('NOT_SET', 99)).toBe(99);
    delete process.env.X;
  });

  it('envBool deve aceitar true e 1 como true', async () => {
    const envModule = await import('@/shared/config/env.js');
    process.env.A = 'true';
    process.env.B = '1';
    process.env.C = 'false';
    process.env.D = '0';
    expect(envModule.envBool('A')).toBe(true);
    expect(envModule.envBool('B')).toBe(true);
    expect(envModule.envBool('C')).toBe(false);
    expect(envModule.envBool('D')).toBe(false);
    expect(envModule.envBool('NOT_SET', true)).toBe(true);
    delete process.env.A;
    delete process.env.B;
    delete process.env.C;
    delete process.env.D;
  });

  it('deve falhar quando MESSAGING_ENABLED=true sem RABBIT_URL', async () => {
    vi.resetModules();
    const originalError = console.error;
    process.env.MESSAGING_ENABLED = 'true';
    process.env.RABBIT_URL = '';
    console.error = vi.fn();

    try {
      await expect(import('@/shared/config/env.js')).rejects.toThrow('Environment validation failed');
    } finally {
      console.error = originalError;
    }
  });
});
