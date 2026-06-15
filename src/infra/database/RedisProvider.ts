import { Redis } from 'ioredis';
import { CONFIG } from '../../shared/config/env.js';
import { logger } from '../../shared/utils/logger.js';

export class RedisProvider {
  private static instance: Redis;

  /* istanbul ignore next */
  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisProvider.instance) {
      const host = process.env.REDIS_HOST ?? CONFIG.REDIS.HOST;
      const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : CONFIG.REDIS.PORT;
      const password = process.env.REDIS_PASSWORD ?? CONFIG.REDIS.PASSWORD;
      const db = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : CONFIG.REDIS.DB;

      const isUrl = host.startsWith('redis://') || host.startsWith('rediss://');

      const options = {
        retryStrategy(times: number): number {
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: null,
        commandTimeout: CONFIG.REDIS.COMMAND_TIMEOUT,
      };

      if (isUrl) {
        RedisProvider.instance = new Redis(host, options);
      } else {
        RedisProvider.instance = new Redis({ host, port, password: password || undefined, db, ...options });
      }

      RedisProvider.instance.on('error', (err: Error) => {
        logger.error({ err }, '[Redis] Error');
      });
      RedisProvider.instance.on('connect', () => {
        logger.info('[Redis] Connected');
      });
    }

    return RedisProvider.instance;
  }

  public static async close(): Promise<void> {
    try {
      await RedisProvider.instance?.quit();
    } catch (err) {
      logger.error({ err }, '[Redis] Error closing');
    } finally {
      RedisProvider.instance = undefined as unknown as Redis;
    }
  }

  public static reset(): void {
    RedisProvider.instance = undefined as unknown as Redis;
  }
}

export const redis = RedisProvider.getInstance();
