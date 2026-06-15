import type { Logger } from 'pino';
import { logger as rootLogger } from '../shared/utils/logger.js';

export type JobContext = {
  logger: Logger;
  signal: AbortSignal;
};

export type JobStatus = 'success' | 'error' | 'skipped';

export type JobResult = {
  job: string;
  status: JobStatus;
  duration_ms: number;
  error?: string;
};

export abstract class BaseJob {
  public abstract readonly name: string;
  public abstract schedule: string;
  public abstract readonly description: string;
  public enabled: boolean = true;

  protected get logger(): Logger {
    return rootLogger.child({ job: this.name });
  }

  protected abstract handle(context: JobContext): Promise<void>;

  public async run(signal: AbortSignal): Promise<JobResult> {
    if (!this.enabled) {
      this.logger.debug({ event: 'job.skipped' }, 'Job disabled, skipping execution');
      return { job: this.name, status: 'skipped', duration_ms: 0 };
    }

    const startedAt = Date.now();
    this.logger.info({ event: 'job.start' }, `Starting job ${this.name}`);

    try {
      await this.handle({ logger: this.logger, signal });
      const duration_ms = Date.now() - startedAt;
      this.logger.info({ event: 'job.success', duration_ms }, `Job ${this.name} finished`);
      return { job: this.name, status: 'success', duration_ms };
    } catch (error) {
      const duration_ms = Date.now() - startedAt;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { event: 'job.error', duration_ms, err: error },
        `Job ${this.name} failed: ${errorMessage}`
      );
      return { job: this.name, status: 'error', duration_ms, error: errorMessage };
    }
  }
}
