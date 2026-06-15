import { auditDb } from '../database/PrismaService.js';
import { logger } from '../../shared/utils/logger.js';
import { businessMetrics } from '../../shared/utils/metrics.js';
import type { Prisma } from '@prisma/audit-client';

const FLUSH_INTERVAL_MS = 200;
const BATCH_SIZE = 50;
const MAX_BUFFER_SIZE = 10_000;

export class AuditBuffer {
  private buffer: Prisma.AuditCreateManyInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { this.flush(); }, FLUSH_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  push(entry: Prisma.AuditCreateManyInput): void {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.buffer.shift();
      businessMetrics.auditDropsTotal.inc();
      logger.warn('[AuditBuffer] Buffer overflow, dropping oldest entry');
    }
    this.buffer.push(entry);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const items = this.buffer.splice(0, BATCH_SIZE);

    try {
      await auditDb.audit.createMany({ data: items });
    } catch (err) {
      logger.error({ err }, '[AuditBuffer] Flush failed');
    }
  }

  async flushAll(): Promise<void> {
    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  get size(): number {
    return this.buffer.length;
  }
}

export const auditBuffer = new AuditBuffer();
