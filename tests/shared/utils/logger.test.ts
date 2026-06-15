import { describe, it, expect, vi } from 'vitest';

describe('logger (real pino instance)', () => {
  it('deve carregar o logger real via importActual', async () => {
    const actual = await vi.importActual<typeof import('@/shared/utils/logger.js')>('@/shared/utils/logger.js');
    expect(actual.logger).toBeDefined();
    expect(typeof actual.logger.info).toBe('function');
    expect(typeof actual.logger.child).toBe('function');
  });

  it('child deve retornar logger com mesmo contrato', async () => {
    const actual = await vi.importActual<typeof import('@/shared/utils/logger.js')>('@/shared/utils/logger.js');
    const child = actual.logger.child({ test: true });
    expect(typeof child.info).toBe('function');
  });

  it('deve logar mensagem info sem throw', async () => {
    const actual = await vi.importActual<typeof import('@/shared/utils/logger.js')>('@/shared/utils/logger.js');
    expect(() => actual.logger.info('test message')).not.toThrow();
  });
});
