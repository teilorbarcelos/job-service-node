import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthCheckJob, type HealthCheckResult, type HealthChecker } from '@/jobs/HealthCheckJob.js';

const makeChecker = (overrides: Partial<Record<'postgres' | 'redis' | 'rabbitmq', HealthCheckResult>> = {}): HealthChecker => ({
  checkPostgres: vi.fn().mockResolvedValue(overrides.postgres ?? { status: 'up', latency_ms: 5 }),
  checkRedis: vi.fn().mockResolvedValue(overrides.redis ?? { status: 'up', latency_ms: 1 }),
  checkRabbitMQ: vi.fn().mockResolvedValue(overrides.rabbitmq ?? { status: 'up' }),
});

const silentLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
} as unknown as import('pino').Logger;

describe('HealthCheckJob', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('deve ter name, schedule e description padrão', () => {
    const job = new HealthCheckJob(makeChecker());
    expect(job.name).toBe('health-check');
    expect(job.schedule).toBe('*/1 * * * *');
    expect(job.description).toMatch(/PostgreSQL/);
    expect(job.description).toMatch(/Redis/);
    expect(job.description).toMatch(/RabbitMQ/);
    expect(job.enabled).toBe(true);
  });

  it('deve chamar os três checkers em paralelo', async () => {
    const checker = makeChecker();
    const job = new HealthCheckJob(checker);
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });

    expect(checker.checkPostgres).toHaveBeenCalledTimes(1);
    expect(checker.checkRedis).toHaveBeenCalledTimes(1);
    expect(checker.checkRabbitMQ).toHaveBeenCalledTimes(1);
  });

  it('deve reportar healthy quando todos estão up', async () => {
    const job = new HealthCheckJob(makeChecker());
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });

    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'health-check', status: 'healthy' }),
      expect.any(String)
    );
  });

  it('deve reportar degraded quando postgres está down', async () => {
    const job = new HealthCheckJob(makeChecker({ postgres: { status: 'down', error: 'refused' } }));
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
      expect.any(String)
    );
  });

  it('deve reportar degraded quando redis está down', async () => {
    const job = new HealthCheckJob(makeChecker({ redis: { status: 'down' } }));
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
      expect.any(String)
    );
  });

  it('deve reportar degraded quando rabbitmq está down', async () => {
    const job = new HealthCheckJob(makeChecker({ rabbitmq: { status: 'down' } }));
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded' }),
      expect.any(String)
    );
  });

  it('deve imprimir linha no console com status', async () => {
    const job = new HealthCheckJob(makeChecker());
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const line = consoleSpy.mock.calls[0][0] as string;
    expect(line).toMatch(/^\[HealthCheck \d{4}-\d{2}-\d{2}T/);
    expect(line).toContain('postgres=up');
    expect(line).toContain('redis=up');
    expect(line).toContain('rabbitmq=up');
  });

  it('deve propagar AbortSignal para os checkers', async () => {
    const checker: HealthChecker = {
      checkPostgres: vi.fn().mockImplementation((signal: AbortSignal) => {
        signal.throwIfAborted();
        return Promise.resolve({ status: 'up' });
      }),
      checkRedis: vi.fn().mockResolvedValue({ status: 'up' }),
      checkRabbitMQ: vi.fn().mockResolvedValue({ status: 'up' }),
    };
    const job = new HealthCheckJob(checker);
    const controller = new AbortController();
    controller.abort();

    await expect(
      job['handle']({ logger: silentLogger, signal: controller.signal })
    ).rejects.toThrow();
  });

  it('deve logar timestamp ISO no payload', async () => {
    const job = new HealthCheckJob(makeChecker());
    await job['handle']({ logger: silentLogger, signal: new AbortController().signal });
    const call = (silentLogger.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as { timestamp: string };
    expect(call.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('deve executar via run() usando BaseJob lifecycle', async () => {
    const job = new HealthCheckJob(makeChecker());
    const result = await job.run(new AbortController().signal);
    expect(result.status).toBe('success');
    expect(result.job).toBe('health-check');
  });
});
