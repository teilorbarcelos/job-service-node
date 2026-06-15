import { Redis } from 'ioredis';
import { CONFIG } from '../../shared/config/env.js';
import { logger } from '../../shared/utils/logger.js';

export class RedisProvider {
  private static instance: Redis;

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisProvider.instance) {
      /* istanbul ignore next */
      const host = process.env.REDIS_HOST ?? CONFIG.REDIS.HOST;
      /* istanbul ignore next */
      const port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : CONFIG.REDIS.PORT;
      /* istanbul ignore next */
      const password = process.env.REDIS_PASSWORD ?? CONFIG.REDIS.PASSWORD;
      /* istanbul ignore next */
      const db = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : CONFIG.REDIS.DB;

      /* istanbul ignore next */
      const isUrl = host.startsWith('redis://') || host.startsWith('rediss://');

      const redisOptions = {
        retryStrategy(times: number) {
          return Math.min(times * 50, 2000);
        },
        maxRetriesPerRequest: null,
        commandTimeout: CONFIG.REDIS.COMMAND_TIMEOUT,
      };

      if (isUrl) {
        RedisProvider.instance = new Redis(host, redisOptions);
      } else {
        RedisProvider.instance = new Redis({ host, port, password: password || undefined, db, ...redisOptions });
      }

      RedisProvider.instance.on('error', (err) => {
        logger.error({ err }, '[Redis] Error');
      });

      RedisProvider.instance.on('connect', () => {
        logger.info('[Redis] Connected successfully');
      });
    }

    return RedisProvider.instance;
  }
}

export const redis = RedisProvider.getInstance();
