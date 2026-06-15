import { logger } from '../../shared/utils/logger.js';
import { redis } from '../database/RedisProvider.js';

export class SessionManager {
  static async invalidateUserSessions(userId: string): Promise<void> {
    const pattern = `session:user:${userId}:*`;
      
    logger.info({ userId, pattern }, '[SessionManager] Invalidating sessions');
    
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info({ keysCount: keys.length, userId }, '[SessionManager] Deleted session keys');
      }
    } while (cursor !== '0');
  }
  
  static async invalidateManyUsersSessions(userIds: string[]): Promise<void> {
    logger.info({ usersCount: userIds.length }, '[SessionManager] Invalidating sessions for multiple users');
    for (const userId of userIds) {
      await this.invalidateUserSessions(userId);
    }
  }
}
