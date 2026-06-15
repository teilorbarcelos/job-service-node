import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuditBuffer } from '@/infra/audit/AuditBuffer.js';
import { auditDb } from '@/infra/database/PrismaService.js';
import { logger } from '@/shared/utils/logger.js';

vi.mock('@/infra/database/PrismaService.js', () => ({
  auditDb: {
    audit: {
      createMany: vi.fn(),
    },
  },
}));

describe('AuditBuffer', () => {
  let buffer: AuditBuffer;

  beforeEach(() => {
    vi.clearAllMocks();
    buffer = new AuditBuffer();
  });

  it('should push entries to buffer', () => {
    buffer.push({ id_user: 'u1', table_name: 'User' } as any);
    buffer.push({ id_user: 'u2', table_name: 'Product' } as any);

    expect(buffer.size).toBe(2);
  });

  it('should flush entries to auditDb', async () => {
    buffer.push({ id_user: 'u1' } as any);

    await buffer.flush();

    expect(auditDb.audit.createMany).toHaveBeenCalledWith({
      data: [{ id_user: 'u1' }],
    });
    expect(buffer.size).toBe(0);
  });

  it('should do nothing on flush when buffer is empty', async () => {
    await buffer.flush();

    expect(auditDb.audit.createMany).not.toHaveBeenCalled();
  });

  it('should drop oldest entry when buffer exceeds max size', () => {
    const maxSize = 10_000;
    for (let i = 0; i < maxSize + 1; i++) {
      buffer.push({ id_user: `u${i}` } as any);
    }

    expect(buffer.size).toBe(maxSize);
  });

  it('should log warning when dropping oldest entry', () => {
    const warnSpy = vi.spyOn(logger, 'warn');

    for (let i = 0; i < 10_001; i++) {
      buffer.push({ id_user: `u${i}` } as any);
    }

    expect(warnSpy).toHaveBeenCalledWith(
      '[AuditBuffer] Buffer overflow, dropping oldest entry',
    );
    warnSpy.mockRestore();
  });

  it('should flush remaining entries with flushAll', async () => {
    buffer.push({ id_user: 'u1' } as any);
    buffer.push({ id_user: 'u2' } as any);

    await buffer.flushAll();

    expect(buffer.size).toBe(0);
    expect(auditDb.audit.createMany).toHaveBeenCalledTimes(1);
  });

  it('should flush in batches', async () => {
    const items = Array.from({ length: 55 }, (_, i) => ({ id_user: `u${i}` }));

    for (const item of items) {
      buffer.push(item as any);
    }

    await buffer.flushAll();

    expect(auditDb.audit.createMany).toHaveBeenCalledTimes(2);
    expect(buffer.size).toBe(0);
  });

  it('should handle flush error gracefully', async () => {
    vi.mocked(auditDb.audit.createMany).mockRejectedValueOnce(new Error('DB error'));
    const errorSpy = vi.spyOn(logger, 'error');

    buffer.push({ id_user: 'u1' } as any);

    await buffer.flush();

    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), '[AuditBuffer] Flush failed');
    errorSpy.mockRestore();
  });

  it('should start and stop timer', () => {
    vi.useFakeTimers();

    buffer.start();
    expect(buffer.size).toBe(0);

    buffer.push({ id_user: 'u1' } as any);
    vi.advanceTimersByTime(200);

    expect(auditDb.audit.createMany).toHaveBeenCalled();

    buffer.stop();
    vi.useRealTimers();
  });

  it('should not start timer twice', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    buffer.start();
    buffer.start();

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });

  it('should stop timer', () => {
    buffer.start();
    buffer.stop();

    buffer.push({ id_user: 'u1' } as any);

    expect(auditDb.audit.createMany).not.toHaveBeenCalled();
  });
});
