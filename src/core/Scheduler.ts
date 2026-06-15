import cron, { type ScheduledTask } from 'node-cron';
import type { BaseJob } from './BaseJob.js';
import { logger as rootLogger } from '../shared/utils/logger.js';

export type CronTask = { stop: () => void };

export type CronAdapter = {
  validate: (expression: string) => boolean;
  schedule: (expression: string, callback: () => void) => CronTask;
};

export const realCronAdapter: CronAdapter = {
  validate: (expression: string) => cron.validate(expression),
  schedule: (expression: string, callback: () => void): CronTask => {
    const task: ScheduledTask = cron.schedule(expression, callback);
    return { stop: () => task.stop() };
  },
};

export type SchedulerOptions = {
  cron?: CronAdapter;
  executionTimeoutMs?: number;
};

export type JobInfo = {
  name: string;
  schedule: string;
  enabled: boolean;
  description: string;
};

export class Scheduler {
  private readonly jobs: Map<string, BaseJob> = new Map();
  private readonly tasks: Map<string, CronTask> = new Map();
  private readonly running: Set<string> = new Set();
  private readonly logger = rootLogger.child({ component: 'Scheduler' });
  private readonly cron: CronAdapter;
  private readonly executionTimeoutMs: number;

  constructor(jobs: BaseJob[], options: SchedulerOptions = {}) {
    this.cron = options.cron ?? realCronAdapter;
    this.executionTimeoutMs = options.executionTimeoutMs ?? 300_000;

    for (const job of jobs) {
      if (this.jobs.has(job.name)) {
        throw new Error(`Duplicate job name: ${job.name}`);
      }
      this.jobs.set(job.name, job);
    }
  }

  public start(): void {
    for (const [name, job] of this.jobs) {
      if (!job.enabled) {
        this.logger.info({ job: name }, 'Job disabled, will not be scheduled');
        continue;
      }

      if (!this.cron.validate(job.schedule)) {
        const message = `Invalid cron expression for job ${name}: ${job.schedule}`;
        this.logger.error({ job: name, schedule: job.schedule }, message);
        throw new Error(message);
      }

      const task = this.cron.schedule(job.schedule, () => {
        void this.execute(name);
      });

      this.tasks.set(name, task);
      this.logger.info(
        { job: name, schedule: job.schedule, description: job.description },
        `Job ${name} scheduled`
      );
    }
  }

  public stop(): void {
    for (const [name, task] of this.tasks) {
      task.stop();
      this.logger.info({ job: name }, `Job ${name} stopped`);
    }
    this.tasks.clear();
  }

  public listJobs(): JobInfo[] {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      description: job.description,
    }));
  }

  public async waitForRunningJobs(): Promise<void> {
    while (this.running.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  public isRunning(name: string): boolean {
    return this.running.has(name);
  }

  private async execute(name: string): Promise<void> {
    if (this.running.has(name)) {
      this.logger.warn({ job: name }, `Job ${name} still running, skipping this iteration`);
      return;
    }

    const job = this.jobs.get(name);
    if (!job) {
      this.logger.error({ job: name }, `Job ${name} not found in registry`);
      return;
    }

    this.running.add(name);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.executionTimeoutMs);

    try {
      await job.run(controller.signal);
    } finally {
      clearTimeout(timeout);
      this.running.delete(name);
    }
  }
}
