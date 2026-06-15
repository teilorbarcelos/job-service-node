import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BcryptPool } from '@/infra/bcrypt/BcryptPool.js';

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('mocked_hash'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

describe('BcryptPool (direct mode)', () => {
  let pool: BcryptPool;

  beforeEach(() => {
    pool = new BcryptPool();
  });

  it('should hash a password', async () => {
    const result = await pool.hash('password123', 10);
    expect(result).toBe('mocked_hash');
  });

  it('should compare password with hash', async () => {
    const result = await pool.compare('password123', 'hashed_value');
    expect(result).toBe(true);
  });

  it('should destroy without errors', async () => {
    await expect(pool.destroy()).resolves.toBeUndefined();
  });
});

describe('BcryptPool (worker mode)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should create pool in worker mode', () => {
    const pool = new (BcryptPool as any)();
    expect((pool as any).useWorker).toBe(true);
    pool.destroy();
  });

  it('should hash and compare via worker', async () => {
    const pool = new BcryptPool();
    const hash = await pool.hash('test123', 10);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);

    const match = await pool.compare('test123', hash);
    expect(match).toBe(true);

    const noMatch = await pool.compare('wrong', hash);
    expect(noMatch).toBe(false);

    await pool.destroy();
  });

  it('should reject on timeout', async () => {
    const pool = new BcryptPool(1);
    const promise = pool.hash('test123', 10);
    await expect(promise).rejects.toThrow('Bcrypt operation timed out');
    await pool.destroy();
  });

  it('should handle stale worker response after timeout', async () => {
    const pool = new BcryptPool(1);
    const promise = pool.hash('test123', 10);
    await expect(promise).rejects.toThrow('Bcrypt operation timed out');
    await new Promise(resolve => setTimeout(resolve, 300));
    await pool.destroy();
  });

  it('should handle stale worker response after timeout', async () => {
    const pool = new BcryptPool(1);
    const promise = pool.hash('test123', 10);
    await expect(promise).rejects.toThrow('Bcrypt operation timed out');
    await new Promise(resolve => setTimeout(resolve, 300));
    await pool.destroy();
  });

  it('should handle worker error and restart', async () => {
    const pool = new BcryptPool();
    const worker = (pool as any).worker;
    worker.emit('error', new Error('Worker crashed'));
    const hash = await pool.hash('test', 10);
    expect(typeof hash).toBe('string');
    await pool.destroy();
  });

  it('should handle worker error with pending operations', async () => {
    const pool = new BcryptPool();
    const hashPromise = pool.hash('test', 10);
    const worker = (pool as any).worker;
    worker.emit('error', new Error('Worker crashed'));
    await expect(hashPromise).rejects.toThrow('Worker crashed');
    await pool.destroy();
  });

  it('should destroy with pending entries', async () => {
    const pool = new BcryptPool(5000);
    const hashPromise = pool.hash('test', 10);
    pool.destroy();
    await expect(hashPromise).rejects.toThrow();
  });
});
