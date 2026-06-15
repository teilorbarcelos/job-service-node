import { Worker } from 'node:worker_threads';
import type { WorkerOptions } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import crypto from 'node:crypto';

type PendingEntry = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

type BcryptModule = { hash: (s: string, r: number) => Promise<string>; compare: (s: string, h: string) => Promise<boolean> };
let bcryptModule: BcryptModule | null = null;

async function loadBcrypt(): Promise<BcryptModule> {
  if (!bcryptModule) bcryptModule = (await import('bcrypt')).default as unknown as BcryptModule;
  return bcryptModule;
}

export class BcryptPool {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingEntry>();
  private useWorker: boolean;
  private operationTimeout: number;

  constructor(operationTimeout = 5000) {
    this.useWorker = process.env['NODE_ENV'] !== 'test';
    this.operationTimeout = operationTimeout;
    if (this.useWorker) this.startWorker();
  }

  private startWorker(): void {
    const dir = dirname(fileURLToPath(import.meta.url));
    const ext = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
    const workerPath = join(dir, `bcrypt.worker${ext}`);

    try {
      this.worker = new Worker(workerPath, { type: 'module' } as unknown as WorkerOptions);
    } catch {
      this.useWorker = false;
      return;
    }

    this.worker.on('message', (msg: { id: string; result?: unknown; error?: string }) => {
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error));
      else entry.resolve(msg.result);
    });

    this.worker.on('error', (err: Error) => {
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(err);
      }
      this.pending.clear();
      this.startWorker();
    });
  }

  private runInWorker(operation: string, data: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Bcrypt operation timed out'));
      }, this.operationTimeout);

      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ id, operation, ...data });
    });
  }

  async hash(plainText: string, rounds: number): Promise<string> {
    if (!this.useWorker) {
      const bcrypt = await loadBcrypt();
      return bcrypt.hash(plainText, rounds);
    }
    return this.runInWorker('hash', { plainText, rounds }) as Promise<string>;
  }

  async compare(plainText: string, hash: string): Promise<boolean> {
    if (!this.useWorker) {
      const bcrypt = await loadBcrypt();
      return bcrypt.compare(plainText, hash);
    }
    return this.runInWorker('compare', { plainText, hash }) as Promise<boolean>;
  }

  async destroy(): Promise<void> {
    if (this.worker) {
      for (const [, entry] of this.pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error('BcryptPool destroyed'));
      }
      this.pending.clear();
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const bcryptPool = new BcryptPool();
