import CircuitBreaker from 'opossum';

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelay = 100,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, baseDelay * 2 ** i));
    }
  }
  throw new Error('Unreachable');
}

export function createCircuitBreaker<TResult>(
  fn: (...args: unknown[]) => Promise<TResult>,
  options: { name: string; timeout?: number },
) {
  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout ?? false,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    name: options.name,
  });

  return {
    fire: (...args: unknown[]) => breaker.fire(...args) as Promise<TResult>, // NOSONAR - necessário para propagar tipo genérico
    status: () => ({
      isOpen: breaker.opened,
      isHalfOpen: breaker.halfOpen,
      stats: breaker.stats,
    }),
    on: (event: string, listener: (...args: unknown[]) => void) => (breaker.on as (event: string, listener: (...args: unknown[]) => void) => typeof breaker)(event, listener),
  };
}
