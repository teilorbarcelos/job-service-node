import { getRequestSignal } from './requestContext.js';

export function createTimeoutSignal(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ?? getRequestSignal();
  if (!requestSignal) return timeoutSignal;
  return AbortSignal.any([timeoutSignal, requestSignal]);
}

export function timeoutPromise<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const signal = createTimeoutSignal(timeoutMs);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')), { once: true });
    }),
  ]);
}
