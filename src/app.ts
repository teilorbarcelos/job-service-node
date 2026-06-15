import { PrismaService } from './infra/database/PrismaService.js';
import { RedisProvider } from './infra/database/RedisProvider.js';
import { messagingProvider } from './infra/messaging/RabbitMQProvider.js';
import { Scheduler } from './core/Scheduler.js';
import { CONFIG } from './shared/config/env.js';
import { logger } from './shared/utils/logger.js';
import { cleanup, registerShutdownHandlers } from './shared/utils/shutdown.js';
import { registerJobs } from './jobs/register-jobs.js';

export type AppContext = {
  scheduler: Scheduler;
  shutdown: () => Promise<void>;
};

export async function buildApp(): Promise<AppContext> {
  const scheduler = registerJobs();

  const shutdown = async (): Promise<void> => {
    logger.info('[Shutdown] Waiting for running jobs to finish...');
    await scheduler.waitForRunningJobs();
    scheduler.stop();
    await cleanup();
  };

  return { scheduler, shutdown };
}

export async function start(): Promise<AppContext> {
  logger.info({ environment: CONFIG.ENVIRONMENT }, '🚀 Starting job-service-node');

  PrismaService.getClient();
  RedisProvider.getInstance();

  if (CONFIG.PROVIDERS.MESSAGING.ENABLED) {
    try {
      await messagingProvider.connect();
    } catch (err) {
      logger.warn({ err }, '[Startup] Failed to connect to RabbitMQ, will retry on demand');
    }
  } else {
    logger.info('[Startup] Messaging disabled (MESSAGING_ENABLED=false)');
  }

  const { scheduler, shutdown } = await buildApp();
  scheduler.start();

  logger.info({ jobs: scheduler.listJobs() }, '📋 Jobs scheduled');

  registerShutdownHandlers(async () => {
    await shutdown();
  });

  return { scheduler, shutdown };
}
