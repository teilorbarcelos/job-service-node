import type { FastifyInstance } from 'fastify';
import { PrismaService } from '../../infra/database/PrismaService.js';
import { redis } from '../../infra/database/RedisProvider.js';
import { messagingProvider } from '../../infra/messaging/RabbitMQProvider.js';
import { auditBuffer } from '../../infra/audit/AuditBuffer.js';
import { CONFIG } from '../config/env.js';
import { logger } from './logger.js';

async function closePrismaPools(): Promise<void> {
  try {
    await PrismaService.mainPool?.end();
  } catch (err) {
    logger.error({ err }, '[Shutdown] Error closing main pool');
  }

  try {
    await PrismaService.auditPool?.end();
  } catch (err) {
    logger.error({ err }, '[Shutdown] Error closing audit pool');
  }
}

async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
  } catch (err) {
    logger.error({ err }, '[Shutdown] Error closing Redis');
  }
}

async function closeMessaging(): Promise<void> {
  try {
    await messagingProvider.disconnect();
  } catch (err) {
    logger.error({ err }, '[Shutdown] Error closing RabbitMQ');
  }
}

export async function cleanup(): Promise<void> {
  logger.info('[Shutdown] Flushing audit buffer...');
  auditBuffer.stop();
  await auditBuffer.flushAll();

  logger.info('[Shutdown] Closing Prisma connections...');
  await closePrismaPools();

  logger.info('[Shutdown] Closing Redis...');
  await closeRedis();

  logger.info('[Shutdown] Closing RabbitMQ...');
  await closeMessaging();

  logger.info('[Shutdown] Cleanup complete.');
}

export function registerShutdownHandlers(app: FastifyInstance): void {
  app.addHook('onClose', async () => {
    await cleanup();
  });

  if (process.env.NODE_ENV !== 'test') {
    const handleSignal = async (signal: string) => {
      logger.info({ signal }, '[Shutdown] Received signal. Starting graceful shutdown...');

      const timeout = setTimeout(() => {
        logger.error({ timeout: CONFIG.SHUTDOWN_TIMEOUT_MS }, '[Shutdown] Forced shutdown after timeout');
        process.exit(1);
      }, CONFIG.SHUTDOWN_TIMEOUT_MS);

      try {
        await app.close();
      } catch (err) {
        logger.error({ err }, '[Shutdown] Error during shutdown');
      } finally {
        clearTimeout(timeout);
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
  }
}
