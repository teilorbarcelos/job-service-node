import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    scan: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/infra/database/RedisProvider.js', () => ({
  redis: mockRedis,
}));

vi.mock('../database/RedisProvider.js', () => ({
  redis: mockRedis,
}));

import { SessionManager } from '@/infra/auth/SessionManager.js';
import { redis } from '@/infra/database/RedisProvider.js';

describe('SessionManager Unit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invalidateUserSessions', () => {
    it('should call scan and del if keys are found', async () => {
      vi.mocked(redis.scan).mockResolvedValueOnce(['0', ['sess1', 'sess2']]);
      vi.mocked(redis.del).mockResolvedValue(2);
      
      await SessionManager.invalidateUserSessions('u1');
      
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'session:user:u1:*', 'COUNT', 100);
      expect(redis.del).toHaveBeenCalledWith('sess1', 'sess2');
    });

    it('should continue scanning until cursor is 0', async () => {
      vi.mocked(redis.scan)
        .mockResolvedValueOnce(['1', ['sess1']])
        .mockResolvedValueOnce(['0', ['sess2']]);
      
      await SessionManager.invalidateUserSessions('u1');
      
      expect(redis.scan).toHaveBeenCalledTimes(2);
      expect(redis.del).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateManyUsersSessions', () => {
    it('should call invalidateUserSessions for each userId', async () => {
      vi.mocked(redis.scan).mockResolvedValue(['0', []]);
      
      await SessionManager.invalidateManyUsersSessions(['u1', 'u2']);
      
      expect(redis.scan).toHaveBeenCalledTimes(2);
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'session:user:u1:*', 'COUNT', 100);
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'session:user:u2:*', 'COUNT', 100);
    });
  });
});
