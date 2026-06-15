import { describe, it, expect, vi } from 'vitest';
import { withRetry, createCircuitBreaker } from '@/shared/utils/resilience.js';

describe('withRetry', () => {
  it('should return the result on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('success');

    expect(await withRetry(fn)).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fail'));

    await expect(withRetry(fn)).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use custom retry count and base delay', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, 1, 10)).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw Unreachable when retries is 0', async () => {
    const fn = vi.fn();

    await expect(withRetry(fn, 0)).rejects.toThrow('Unreachable');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('createCircuitBreaker', () => {
  it('should fire and return result', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const cb = createCircuitBreaker(fn, { name: 'test' });

    expect(await cb.fire()).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reject when action fails', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const cb = createCircuitBreaker(fn, { name: 'test-fail' });

    await expect(cb.fire()).rejects.toThrow('fail');
  });

  it('should provide status method', () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const cb = createCircuitBreaker(fn, { name: 'test-status' });

    const status = cb.status();
    expect(status).toHaveProperty('isOpen');
    expect(status).toHaveProperty('isHalfOpen');
    expect(status).toHaveProperty('stats');
  });

  it('should provide on method for events', () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const cb = createCircuitBreaker(fn, { name: 'test-events' });

    const listener = vi.fn();
    cb.on('failure', listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
