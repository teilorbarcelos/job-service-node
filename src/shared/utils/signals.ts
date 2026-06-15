export function createTimeoutSignal(timeoutMs: number, externalSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!externalSignal) return timeoutSignal;
  return AbortSignal.any([timeoutSignal, externalSignal]);
}

export function timeoutPromise<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const signal = createTimeoutSignal(timeoutMs);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted', 'AbortError')),
        { once: true }
      );
    }),
  ]);
}
