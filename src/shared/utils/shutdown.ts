import { PrismaService } from '../../infra/database/PrismaService.js';
import { RedisProvider } from '../../infra/database/RedisProvider.js';
import { messagingProvider } from '../../infra/messaging/RabbitMQProvider.js';
import { CONFIG } from '../config/env.js';
import { logger } from './logger.js';

export async function cleanup(): Promise<void> {
  logger.info('[Shutdown] Stopping job scheduler and closing connections...');

  logger.info('[Shutdown] Closing RabbitMQ');
  await messagingProvider.disconnect();

  logger.info('[Shutdown] Closing Redis');
  await RedisProvider.close();

  logger.info('[Shutdown] Closing Prisma');
  await PrismaService.close();

  logger.info('[Shutdown] Cleanup complete');
}

export function registerShutdownHandlers(handler: () => Promise<void>): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const handleSignal = async (signal: string): Promise<void> => {
    logger.info({ signal }, '[Shutdown] Signal received, starting graceful shutdown');

    const timeout = setTimeout(() => {
      logger.error({ timeout: CONFIG.SHUTDOWN_TIMEOUT_MS }, '[Shutdown] Forced exit after timeout');
      process.exit(1);
    }, CONFIG.SHUTDOWN_TIMEOUT_MS);

    try {
      await handler();
    } catch (err) {
      logger.error({ err }, '[Shutdown] Error during shutdown handler');
    } finally {
      clearTimeout(timeout);
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => {
    void handleSignal('SIGTERM');
  });
  process.on('SIGINT', () => {
    void handleSignal('SIGINT');
  });
}
