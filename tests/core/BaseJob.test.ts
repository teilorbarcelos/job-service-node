import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseJob, type JobContext, type JobResult } from '@/core/BaseJob.js';

class TestJob extends BaseJob {
  public readonly name = 'test';
  public readonly schedule = '* * * * *';
  public readonly description = 'Test job';

  public handleFn: (context: JobContext) => Promise<void> = async () => {};

  protected async handle(context: JobContext): Promise<void> {
    await this.handleFn(context);
  }
}

describe('BaseJob', () => {
  let job: TestJob;

  beforeEach(() => {
    job = new TestJob();
  });

  it('deve expor name, schedule, description e enabled', () => {
    expect(job.name).toBe('test');
    expect(job.schedule).toBe('* * * * *');
    expect(job.description).toBe('Test job');
    expect(job.enabled).toBe(true);
  });

  it('deve permitir desabilitar o job', () => {
    job.enabled = false;
    expect(job.enabled).toBe(false);
  });

  it('deve executar handle e retornar success', async () => {
    const handleFn = vi.fn().mockResolvedValue(undefined);
    job.handleFn = handleFn;
    const result: JobResult = await job.run(new AbortController().signal);

    expect(result.status).toBe('success');
    expect(result.job).toBe('test');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(handleFn).toHaveBeenCalledTimes(1);
  });

  it('deve retornar skipped quando desabilitado', async () => {
    job.enabled = false;
    const handleFn = vi.fn();
    job.handleFn = handleFn;
    const result = await job.run(new AbortController().signal);

    expect(result.status).toBe('skipped');
    expect(result.duration_ms).toBe(0);
    expect(result.error).toBeUndefined();
    expect(handleFn).not.toHaveBeenCalled();
  });

  it('deve retornar error quando handle lança Error', async () => {
    const error = new Error('boom');
    job.handleFn = vi.fn().mockRejectedValue(error);
    const result = await job.run(new AbortController().signal);

    expect(result.status).toBe('error');
    expect(result.job).toBe('test');
    expect(result.error).toBe('boom');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('deve retornar error quando handle lança valor não-Error', async () => {
    job.handleFn = vi.fn().mockRejectedValue('string error');
    const result = await job.run(new AbortController().signal);

    expect(result.status).toBe('error');
    expect(result.error).toBe('string error');
  });

  it('deve passar AbortSignal e logger para handle', async () => {
    let received: JobContext | undefined;
    job.handleFn = vi.fn().mockImplementation(context => {
      received = context;
      return Promise.resolve();
    });

    const controller = new AbortController();
    await job.run(controller.signal);

    expect(received).toBeDefined();
    expect(received?.signal).toBe(controller.signal);
    expect(received?.logger).toBeDefined();
    expect(typeof received?.logger.info).toBe('function');
  });

  it('deve logar eventos de start, success e error', async () => {
    const logger = job['logger'] as unknown as { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

    job.handleFn = vi.fn().mockResolvedValue(undefined);
    await job.run(new AbortController().signal);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'job.start' }), expect.any(String));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'job.success' }), expect.any(String));

    job.handleFn = vi.fn().mockRejectedValue(new Error('fail'));
    await job.run(new AbortController().signal);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'job.error', err: expect.any(Error) }),
      expect.any(String)
    );
  });

  it('deve logar debug quando skipped', async () => {
    job.enabled = false;
    const logger = job['logger'] as unknown as { debug: ReturnType<typeof vi.fn> };
    await job.run(new AbortController().signal);
    expect(logger.debug).toHaveBeenCalledWith(expect.objectContaining({ event: 'job.skipped' }), expect.any(String));
  });

  it('deve medir duração mesmo quando handle falha', async () => {
    job.handleFn = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      throw new Error('late fail');
    });
    const result = await job.run(new AbortController().signal);
    expect(result.status).toBe('error');
    expect(result.duration_ms).toBeGreaterThanOrEqual(10);
  });
});
