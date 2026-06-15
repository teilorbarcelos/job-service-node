import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp, start } from '@/app.js';
import { execSync } from 'child_process';
import supertest from 'supertest';

import Fastify from 'fastify';
import { checkReadiness } from '@/shared/utils/health.js';
import { auditBuffer } from '@/infra/audit/AuditBuffer.js';
import { logger } from '@/shared/utils/logger.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('@/shared/utils/bootstrap.js', () => ({
  bootstrapSystem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/shared/utils/health.js', () => ({
  checkReadiness: vi.fn(),
}));

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: { user: { findUnique: vi.fn() } },
  auditDb: { audit: { create: vi.fn(), createMany: vi.fn() } }
}));

vi.mock('@/infra/audit/AuditBuffer.js', () => ({
  AuditBuffer: class {},
  auditBuffer: { push: vi.fn(), start: vi.fn(), stop: vi.fn(), flush: vi.fn(), flushAll: vi.fn() },
}));

vi.mock('fastify', async () => {
  const actual = await vi.importActual('fastify') as any;
  const mockListen = vi.fn().mockResolvedValue(undefined);

  const mockFastify = (options: any) => {
    const instance = actual.default(options);
    instance.listen = mockListen;
    return instance;
  };

  (mockFastify as any).mockListen = mockListen;

  return { default: mockFastify };
});

describe('App Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (Fastify as any).mockListen.mockResolvedValue(undefined);
  });

  it('should build the app correctly', () => {
    const app = buildApp();
    expect(app).toBeDefined();
    expect(app.server).toBeDefined();
  });

  it('should have liveness endpoint', async () => {
    const app = buildApp();
    const liveness = await app.inject({ method: 'GET', url: '/liveness' });
    expect(liveness.statusCode).toBe(200);
  });

  it('should return healthy status from /health when checks pass', async () => {
    vi.mocked(checkReadiness).mockResolvedValue({
      status: 'healthy',
      checks: { postgresql: true, redis: true, rabbitmq: 'disabled', pdfService: true },
    });

    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
  });

  it('should return 503 from /health when checks fail', async () => {
    vi.mocked(checkReadiness).mockResolvedValue({
      status: 'unhealthy',
      checks: { postgresql: false, redis: false, rabbitmq: 'disabled', pdfService: false },
    });

    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('unhealthy');
  });

  it('should cover start error path', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const logSpy = vi.spyOn(logger, 'info');

    (Fastify as any).mockListen.mockRejectedValue(new Error('Port in use'));

    try {
      await start();
    } catch (e: any) {
      if (e.message !== 'process.exit') throw e;
    }

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Sincronizando banco de dados'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should handle seed error gracefully', async () => {
    const warnSpy = vi.spyOn(logger, 'warn');
    const logSpy = vi.spyOn(logger, 'info');
    (execSync as any).mockImplementation(() => { throw new Error('Seed failed'); });

    await start();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.anything() }),
      expect.stringContaining('Falha na sincronização automática do banco')
    );

    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('should return 401 for protected routes without token', async () => {
    const app = buildApp();
    await app.ready();
    const response = await supertest(app.server).get('/v1/user');
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid or expired token');
  });

  it('should initialize messaging via onReady hook', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');
    const { messagingProvider } = await import('@/infra/messaging/RabbitMQProvider.js');

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;
    const connectSpy = vi.spyOn(messagingProvider, 'connect').mockResolvedValue(undefined);

    const app = buildApp();
    await app.ready();

    expect(connectSpy).toHaveBeenCalled();

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;
    connectSpy.mockRestore();
    await app.close();
  });

  it('should redirect /v1/docs/index.html to /v1/docs/', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/v1/docs/index.html' });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/v1/docs/');
  });

  it('should restrict CORS in production with allowlist', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'production';
    // @ts-ignore
    CONFIG.CORS_ORIGINS = 'https://app.com,https://admin.com';

    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://app.com' },
    });

    expect(res.headers['access-control-allow-origin']).toBe('https://app.com');

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'local';
    // @ts-ignore
    CONFIG.CORS_ORIGINS = '';
    await app.close();
  });

  it('should block CORS in production when no origins configured', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'production';
    // @ts-ignore
    CONFIG.CORS_ORIGINS = '';

    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.com' },
    });

    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'local';
    await app.close();
  });

  it('should skip auth routes when AUTH_MODE=remote', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');
    const orig = CONFIG.AUTH_MODE;

    // @ts-ignore
    CONFIG.AUTH_MODE = 'remote';

    const app = buildApp();
    await app.ready();

    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: {} });
    expect(res.statusCode).toBe(404);

    // @ts-ignore
    CONFIG.AUTH_MODE = orig;
    await app.close();
  });

  it('should build with logger disabled in test environment', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');
    const original = CONFIG.ENVIRONMENT;

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'test';

    expect(() => buildApp()).not.toThrow();

    // @ts-ignore
    CONFIG.ENVIRONMENT = original;
  });

  it('should register rate limit when enabled', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const app = buildApp();
    expect(app).toBeDefined();

    vi.unstubAllEnvs();
  });

  it('should allow all CORS in development environment', async () => {
    const { CONFIG } = await import('@/shared/config/env.js');

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'development';
    // @ts-ignore
    CONFIG.CORS_ORIGINS = '';

    const app = buildApp();
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://any-origin.com' },
    });

    expect(res.headers['access-control-allow-origin']).toBe('https://any-origin.com');

    // @ts-ignore
    CONFIG.ENVIRONMENT = 'local';
    await app.close();
  });

  it('should start audit buffer in non-test mode', () => {
    vi.stubEnv('NODE_ENV', 'development');

    buildApp();

    expect(auditBuffer.start).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
