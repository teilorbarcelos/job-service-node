import { BaseJob, type JobContext } from '../core/BaseJob.js';

export type HealthCheckResult = {
  status: 'up' | 'down' | 'disabled';
  latency_ms?: number;
  error?: string;
};

export type HealthChecker = {
  checkPostgres: (signal: AbortSignal) => Promise<HealthCheckResult>;
  checkRedis: (signal: AbortSignal) => Promise<HealthCheckResult>;
  checkRabbitMQ: (signal: AbortSignal) => Promise<HealthCheckResult>;
};

export class HealthCheckJob extends BaseJob {
  public readonly name = 'health-check';
  public readonly description = 'Reports connection status with PostgreSQL, Redis and RabbitMQ';
  public schedule: string;

  private readonly checker: HealthChecker;

  constructor(checker: HealthChecker, schedule = '*/1 * * * *') {
    super();
    this.checker = checker;
    this.schedule = schedule;
  }

  protected async handle(context: JobContext): Promise<void> {
    const timestamp = new Date().toISOString();

    const [postgres, redis, rabbitmq] = await Promise.all([
      this.checker.checkPostgres(context.signal),
      this.checker.checkRedis(context.signal),
      this.checker.checkRabbitMQ(context.signal),
    ]);

    const allUp =
      postgres.status === 'up' && redis.status === 'up' && rabbitmq.status === 'up';

    context.logger.info(
      {
        event: 'health-check',
        status: allUp ? 'healthy' : 'degraded',
        timestamp,
        postgres,
        redis,
        rabbitmq,
      },
      'Health check completed'
    );

    console.log(
      `[HealthCheck ${timestamp}] postgres=${postgres.status} redis=${redis.status} rabbitmq=${rabbitmq.status}`
    );
  }
}
