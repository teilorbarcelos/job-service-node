import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  signal?: AbortSignal;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return als.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return als.getStore();
}

export function getRequestId(): string {
  return als.getStore()?.requestId ?? '';
}

export function getRequestSignal(): AbortSignal | undefined {
  return als.getStore()?.signal;
}
