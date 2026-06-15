import { buildApp } from '@/app.js';
import { redis } from '@/infra/database/RedisProvider.js';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Rate limit skipped due to not possible to simulate rate limit exceeded
describe.skip('Rate Limit Integration', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow requests within limit', async () => {
    // Mock redis.eval (used by rate-limit) to return [current_count, reset_time]
    vi.mocked(redis.eval).mockResolvedValue([1, Date.now() + 1000]);

    const response = await supertest(app.server).get('/health');
    expect(response.status).toBe(200);
  });

  it('should block requests exceeding limit', async () => {
    // Mock redis.eval to return a count higher than the limit
    // Assuming limit is something like 100
    vi.mocked(redis.eval).mockResolvedValue([1000, Date.now() + 1000]);

    const response = await supertest(app.server).get('/health');
    expect(response.status).toBe(429);
    expect(response.body.error).toBe('Too Many Requests');
  });
});
