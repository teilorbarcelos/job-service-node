import { CONFIG } from '../../shared/config/env.js';
import { PrismaService } from '../database/PrismaService.js';
import { RedisProvider } from '../database/RedisProvider.js';
import { messagingProvider } from '../messaging/RabbitMQProvider.js';
import { logger } from '../../shared/utils/logger.js';
import type { HealthCheckResult, HealthChecker } from '../../jobs/HealthCheckJob.js';

export class DefaultHealthChecker implements HealthChecker {
  public async checkPostgres(signal: AbortSignal): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await PrismaService.getClient().$queryRaw`SELECT 1`;
      signal.throwIfAborted();
      return { status: 'up', latency_ms: Date.now() - start };
    } catch (error) {
      logger.error({ err: error }, '[HealthCheck] PostgreSQL check failed');
      return {
        status: 'down',
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async checkRedis(signal: AbortSignal): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const result = await RedisProvider.getInstance().ping();
      signal.throwIfAborted();
      return {
        status: result === 'PONG' ? 'up' : 'down',
        latency_ms: Date.now() - start,
      };
    } catch (error) {
      logger.error({ err: error }, '[HealthCheck] Redis check failed');
      return {
        status: 'down',
        latency_ms: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  public async checkRabbitMQ(signal: AbortSignal): Promise<HealthCheckResult> {
    try {
      if (!CONFIG.PROVIDERS.MESSAGING.ENABLED) {
        signal.throwIfAborted();
        return { status: 'disabled' };
      }
      const isConnected = messagingProvider.check();
      signal.throwIfAborted();
      return { status: isConnected ? 'up' : 'down' };
    } catch (error) {
      logger.error({ err: error }, '[HealthCheck] RabbitMQ check failed');
      return {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
