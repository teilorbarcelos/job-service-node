import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaService } from '@/infra/database/PrismaService.js';
import { redis } from '@/infra/database/RedisProvider.js';
import { messagingProvider } from '@/infra/messaging/RabbitMQProvider.js';
import { CONFIG } from '@/shared/config/env.js';
import { checkReadiness } from '@/shared/utils/health.js';

describe('checkReadiness', () => {
  beforeEach(() => {
    PrismaService.mainPool = null;
    PrismaService.auditPool = null;
    vi.restoreAllMocks();
  });

  it('should report unhealthy when all services are down', async () => {
    (redis as any).ping = vi.fn().mockRejectedValue(new Error('not connected'));
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unreachable'));

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.postgresql).toBe('not_initialized');
    expect(result.checks.redis).toBe(false);
  });

  it('should report healthy when all services are up', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const result = await checkReadiness();

    expect(result.status).toBe('healthy');
    expect(result.checks.postgresql).toBe(true);
    expect(result.checks.redis).toBe(true);
    expect(result.checks.rabbitmq).toBe('disabled');
    expect(result.checks.pdfService).toBe(true);
  });

  it('should handle PostgreSQL query failure', async () => {
    const client = { query: vi.fn().mockRejectedValue(new Error('db error')), release: vi.fn() };
    PrismaService.mainPool = { connect: vi.fn().mockResolvedValue(client) } as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.postgresql).toBe(false);
  });

  it('should handle Redis ping failure', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const result = await checkReadiness();

    expect(result.status).toBe('healthy');
  });

  it('should handle Redis ping throwing', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockRejectedValue(new Error('timeout'));

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.redis).toBe(false);
  });

  it('should handle RabbitMQ enabled and healthy', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');
    vi.spyOn(messagingProvider, 'check').mockResolvedValue(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    const result = await checkReadiness();

    expect(result.status).toBe('healthy');
    expect(result.checks.rabbitmq).toBe(true);
  });

  it('should handle RabbitMQ enabled but unhealthy', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.rabbitmq).toBe(false);
  });

  it('should handle RabbitMQ check throwing', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');
    vi.spyOn(messagingProvider, 'check').mockRejectedValue(new Error('connection lost'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = true;

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.rabbitmq).toBe(false);
  });

  it('should handle PDF service fetch failure', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');
    vi.spyOn(messagingProvider, 'check').mockResolvedValue(false);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('service unreachable'));

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.pdfService).toBe(false);
  });

  it('should handle PDF service returning non-ok status', async () => {
    const pool = { connect: vi.fn().mockResolvedValue({ query: vi.fn().mockResolvedValue(undefined), release: vi.fn() }) };
    PrismaService.mainPool = pool as any;

    (redis as any).ping = vi.fn().mockResolvedValue('PONG');
    vi.spyOn(messagingProvider, 'check').mockResolvedValue(false);

    // @ts-ignore
    CONFIG.PROVIDERS.MESSAGING.ENABLED = false;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);

    const result = await checkReadiness();

    expect(result.status).toBe('unhealthy');
    expect(result.checks.pdfService).toBe(false);
  });
});
