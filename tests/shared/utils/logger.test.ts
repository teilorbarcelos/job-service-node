import { describe, it, expect } from 'vitest';

describe('logger', () => {
  it('should be an object with logging methods', async () => {
    const { logger } = await vi.importActual<any>('@/shared/utils/logger.js');

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
    expect(typeof logger.trace).toBe('function');
  });
});
