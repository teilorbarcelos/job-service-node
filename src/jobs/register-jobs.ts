import { CONFIG } from '../shared/config/env.js';
import { Scheduler } from '../core/Scheduler.js';
import { HealthCheckJob } from './HealthCheckJob.js';
import { DefaultHealthChecker } from '../infra/health/DefaultHealthChecker.js';

export function registerJobs(): Scheduler {
  const healthCheckJob = new HealthCheckJob(new DefaultHealthChecker());
  healthCheckJob.enabled = CONFIG.JOBS.HEALTH_CHECK_ENABLED;
  healthCheckJob.schedule = CONFIG.JOBS.HEALTH_CHECK_CRON;

  const jobs = [healthCheckJob];

  return new Scheduler(jobs, { executionTimeoutMs: CONFIG.JOB_EXECUTION_TIMEOUT_MS });
}
