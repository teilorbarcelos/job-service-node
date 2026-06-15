import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler, realCronAdapter, type CronAdapter, type CronTask } from '@/core/Scheduler.js';
import { BaseJob, type JobContext } from '@/core/BaseJob.js';

class TestJob extends BaseJob {
  public readonly name: string;
  public readonly schedule: string;
  public readonly description: string;
  public handleFn: (context: JobContext) => Promise<void> = async () => {};

  constructor(name: string, schedule = '*/5 * * * *', description = 'Test job') {
    super();
    this.name = name;
    this.schedule = schedule;
    this.description = description;
  }

  protected async handle(context: JobContext): Promise<void> {
    await this.handleFn(context);
  }
}

describe('Scheduler', () => {
  let scheduledCallbacks: Map<string, () => void>;
  let mockTask: CronTask;
  let mockCron: CronAdapter;

  beforeEach(() => {
    scheduledCallbacks = new Map();
    mockTask = { stop: vi.fn() };
    mockCron = {
      validate: vi.fn().mockReturnValue(true),
      schedule: vi.fn().mockImplementation((expression: string, callback: () => void): CronTask => {
        scheduledCallbacks.set(expression, callback);
        return mockTask;
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve listar jobs registrados', () => {
    const jobs = [new TestJob('a'), new TestJob('b')];
    const scheduler = new Scheduler(jobs, { cron: mockCron });
    expect(scheduler.listJobs()).toEqual([
      { name: 'a', schedule: '*/5 * * * *', enabled: true, description: 'Test job' },
      { name: 'b', schedule: '*/5 * * * *', enabled: true, description: 'Test job' },
    ]);
  });

  it('deve falhar com nomes duplicados', () => {
    const jobs = [new TestJob('dup'), new TestJob('dup')];
    expect(() => new Scheduler(jobs, { cron: mockCron })).toThrow('Duplicate job name: dup');
  });

  it('deve validar expressão cron de cada job ao iniciar', () => {
    const validate = vi.fn().mockReturnValue(true);
    const cron: CronAdapter = { ...mockCron, validate };
    const scheduler = new Scheduler([new TestJob('a', '*/5 * * * *')], { cron });
    scheduler.start();
    expect(validate).toHaveBeenCalledWith('*/5 * * * *');
  });

  it('deve falhar se expressão cron for inválida', () => {
    const validate = vi.fn().mockReturnValue(false);
    const cron: CronAdapter = { ...mockCron, validate };
    const scheduler = new Scheduler([new TestJob('a', 'invalid')], { cron });
    expect(() => scheduler.start()).toThrow('Invalid cron expression for job a: invalid');
  });

  it('deve agendar jobs habilitados', () => {
    const scheduler = new Scheduler([new TestJob('a')], { cron: mockCron });
    scheduler.start();
    expect(scheduledCallbacks.size).toBe(1);
    expect(scheduledCallbacks.has('*/5 * * * *')).toBe(true);
  });

  it('não deve agendar jobs desabilitados', () => {
    const job = new TestJob('a');
    job.enabled = false;
    const scheduler = new Scheduler([job], { cron: mockCron });
    scheduler.start();
    expect(scheduledCallbacks.size).toBe(0);
  });

  it('deve executar job quando callback é disparado', async () => {
    const job = new TestJob('a');
    const handleFn = vi.fn().mockResolvedValue(undefined);
    job.handleFn = handleFn;
    const scheduler = new Scheduler([job], { cron: mockCron });
    scheduler.start();

    const callback = scheduledCallbacks.get('*/5 * * * *');
    expect(callback).toBeDefined();
    await callback!();

    expect(handleFn).toHaveBeenCalledTimes(1);
  });

  it('deve parar todas as tasks', () => {
    const scheduler = new Scheduler([new TestJob('a'), new TestJob('b', '*/10 * * * *')], { cron: mockCron });
    scheduler.start();
    scheduler.stop();
    expect(mockTask.stop).toHaveBeenCalled();
  });

  it('deve prevenir sobreposição quando job já está rodando', async () => {
    let resolveHandle: (() => void) | null = null;
    const job = new TestJob('a');
    job.handleFn = vi.fn().mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveHandle = resolve;
        })
    );
    const scheduler = new Scheduler([job], { cron: mockCron, executionTimeoutMs: 5000 });
    scheduler.start();

    const callback = scheduledCallbacks.get('*/5 * * * *')!;
    const first = callback();
    await Promise.resolve();

    await callback();
    expect(job.handleFn).toHaveBeenCalledTimes(1);

    resolveHandle!();
    await first;
  });

  it('deve abortar job que excede executionTimeoutMs', async () => {
    vi.useFakeTimers();
    const job = new TestJob('a');
    let observedSignal: AbortSignal | null = null;
    job.handleFn = vi.fn().mockImplementation(context => {
      observedSignal = context.signal;
      return new Promise(() => {});
    });
    const scheduler = new Scheduler([job], { cron: mockCron, executionTimeoutMs: 1000 });
    scheduler.start();

    const callback = scheduledCallbacks.get('*/5 * * * *')!;
    void callback();
    await vi.advanceTimersByTimeAsync(1500);

    expect(observedSignal).not.toBeNull();
    expect(observedSignal!.aborted).toBe(true);
  });

  it('deve aguardar execuções em curso em waitForRunningJobs', async () => {
    let resolveHandle: (() => void) | null = null;
    const job = new TestJob('a');
    job.handleFn = vi.fn().mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveHandle = resolve;
        })
    );
    const scheduler = new Scheduler([job], { cron: mockCron });
    scheduler.start();

    const callback = scheduledCallbacks.get('*/5 * * * *')!;
    void callback();
    await Promise.resolve();

    const waitPromise = scheduler.waitForRunningJobs();
    expect(scheduler.isRunning('a')).toBe(true);

    resolveHandle!();
    await waitPromise;
    expect(scheduler.isRunning('a')).toBe(false);
  });

  it('deve logar job não encontrado quando callback orfa dispara execute', async () => {
    const scheduler = new Scheduler([], { cron: mockCron });
    await scheduler['execute']('ghost');
    expect(scheduler.isRunning('ghost')).toBe(false);
  });

  it('deve usar realCronAdapter quando cron não é fornecido', () => {
    const scheduler = new Scheduler([], { executionTimeoutMs: 1000 });
    expect(scheduler).toBeDefined();
  });

  it('deve usar defaults quando options não é fornecido', () => {
    const scheduler = new Scheduler([]);
    expect(scheduler).toBeDefined();
  });

  it('deve tratar exception lançada por handle sem derrubar scheduler', async () => {
    const job = new TestJob('a');
    job.handleFn = vi.fn().mockRejectedValue(new Error('handled by BaseJob'));
    const scheduler = new Scheduler([job], { cron: mockCron });
    scheduler.start();

    const callback = scheduledCallbacks.get('*/5 * * * *')!;
    void callback();
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
    expect(scheduler.isRunning('a')).toBe(false);
  });
});

describe('realCronAdapter', () => {
  it('validate deve aceitar expressões válidas', () => {
    expect(realCronAdapter.validate('*/5 * * * *')).toBe(true);
    expect(realCronAdapter.validate('0 0 * * *')).toBe(true);
  });

  it('validate deve rejeitar expressões inválidas', () => {
    expect(realCronAdapter.validate('invalid')).toBe(false);
  });

  it('schedule deve agendar e stop deve parar', () => {
    const task = realCronAdapter.schedule('*/5 * * * *', () => {});
    expect(typeof task.stop).toBe('function');
    task.stop();
  });
});
