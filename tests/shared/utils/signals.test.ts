import { describe, it, expect } from 'vitest';
import { createTimeoutSignal, timeoutPromise } from '@/shared/utils/signals.js';

describe('createTimeoutSignal', () => {
  it('deve retornar signal com timeout se nenhum external fornecido', () => {
    const signal = createTimeoutSignal(60_000);
    expect(signal.aborted).toBe(false);
  });

  it('deve combinar external + timeout via AbortSignal.any', () => {
    const external = new AbortController();
    const signal = createTimeoutSignal(60_000, external.signal);
    expect(signal.aborted).toBe(false);
    external.abort();
    expect(signal.aborted).toBe(true);
  });
});

describe('timeoutPromise', () => {
  it('deve resolver quando promise resolve antes do timeout', async () => {
    const result = await timeoutPromise(Promise.resolve('ok'), 1000);
    expect(result).toBe('ok');
  });

  it('deve rejeitar quando timeout estoura', async () => {
    const never = new Promise<string>(() => {});
    await expect(timeoutPromise(never, 10)).rejects.toBeInstanceOf(DOMException);
  });
});
