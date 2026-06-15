import { describe, it, expect, vi } from 'vitest';
import { createTimeoutSignal, timeoutPromise } from '@/shared/utils/signals.js';

describe('createTimeoutSignal', () => {
  it('should create a signal that aborts after timeout', () => {
    const signal = createTimeoutSignal(50000);
    expect(signal.aborted).toBe(false);
  });

  it('should combine with an external signal', () => {
    const ctrl = new AbortController();
    const signal = createTimeoutSignal(50000, ctrl.signal);
    expect(signal.aborted).toBe(false);
    ctrl.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe('timeoutPromise', () => {
  it('should resolve when the promise resolves before timeout', async () => {
    const result = await timeoutPromise(Promise.resolve('ok'), 50000);
    expect(result).toBe('ok');
  });

  it('should reject when the promise rejects', async () => {
    await expect(timeoutPromise(Promise.reject(new Error('fail')), 50000)).rejects.toThrow('fail');
  });

  it('should reject on timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 50000));
    await expect(timeoutPromise(slow, 1)).rejects.toThrow();
  });
});
