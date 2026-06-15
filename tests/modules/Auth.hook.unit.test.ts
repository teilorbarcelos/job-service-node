import { authorizeAdmin, checkPermission, errorHandler } from '@/api/hooks/auth.hook.js';
import { AppError } from '@/shared/errors/index.js';
import { describe, expect, it, vi, beforeAll } from 'vitest';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {},
  auditDb: {
    audit: { create: vi.fn() },
    errorLog: { create: vi.fn() }
  }
}));

describe('Auth Hook Unit Tests', () => {
  beforeAll(async () => {
    const { Counter, register } = await import('prom-client');
    if (!register.getSingleMetric('nodejs_errors_total')) {
      new Counter({
        name: 'nodejs_errors_total',
        help: 'Total number of application errors/exceptions',
        labelNames: ['type'],
      });
    }
  });
  describe('checkPermission', () => {
    it('should throw AppError if feature is missing (line 33)', async () => {
      const hook = checkPermission('test-feature', 'view');
      const request: any = { 
        user: { 
          id: '1', 
          email: 't@t.com', 
          roleId: 'r1', 
          permissions: [] 
        } 
      };
      
      await expect(hook(request, {} as any)).rejects.toThrow(AppError);
      await expect(hook(request, {} as any)).rejects.toThrow('Sem permissão para view em test-feature');
    });

    it('should throw AppError if permission action is false (line 33)', async () => {
      const hook = checkPermission('test-feature', 'view');
      const request: any = { 
        user: { 
          id: '1', 
          email: 't@t.com', 
          roleId: 'r1', 
          permissions: [{ feature: 'test-feature', view: false }] 
        } 
      };
      
      await expect(hook(request, {} as any)).rejects.toThrow(AppError);
    });

    it('should throw AppError if permissions array is missing (line 33)', async () => {
      const hook = checkPermission('test-feature', 'view');
      const request: any = { 
        user: { 
          id: '1', 
          email: 't@t.com', 
          roleId: 'r1'
        } 
      };
      
      await expect(hook(request, {} as any)).rejects.toThrow(AppError);
    });
  });

  describe('authorizeAdmin', () => {
    it('should throw AppError if not admin (line 21)', async () => {
      const request: any = { user: { roleId: 'user' } };
      await expect(authorizeAdmin(request, {} as any)).rejects.toThrow('Apenas administradores');
    });

    it('should throw AppError if user is missing (line 21)', async () => {
      const request: any = {};
      await expect(authorizeAdmin(request, {} as any)).rejects.toThrow('Apenas administradores');
    });
  });

  describe('errorHandler', () => {
    it('should log error if auditDb fails (line 58-60)', async () => {
      const { auditDb } = await import('@/infra/database/PrismaService.js');
      // @ts-ignore
      vi.mocked(auditDb.errorLog.create).mockRejectedValueOnce(new Error('Audit DB Fail'));

      const error = new Error('Normal Error');
      const request: any = { method: 'GET', url: '/test', user: { id: '1' }, body: {}, query: {}, params: {}, log: { error: vi.fn() } };
      const reply: any = { 
        status: vi.fn().mockReturnThis(), 
        send: vi.fn().mockReturnThis(),
        log: { error: vi.fn() }
      };

      await errorHandler(error, request, reply);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(request.log.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.stringContaining('Falha ao salvar errorLog'));
    });

    it('should fall back to "Error" label if error has no name', async () => {
      const { auditDb } = await import('@/infra/database/PrismaService.js');
      vi.mocked(auditDb.errorLog.create).mockResolvedValueOnce({} as any);

      const error = new Error('Some error');
      // Delete name or set it to empty string
      Object.defineProperty(error, 'name', { value: '' });
      const request: any = { method: 'GET', url: '/test', user: { id: '1' }, log: { error: vi.fn() } };
      const reply: any = { status: vi.fn().mockReturnValue({ send: vi.fn() }) };

      await expect(errorHandler(error, request, reply)).resolves.toBeUndefined();
    });

    it('should handle errorsTotal metric being undefined', async () => {
      const { register } = await import('prom-client');
      const { auditDb } = await import('@/infra/database/PrismaService.js');
      vi.mocked(auditDb.errorLog.create).mockResolvedValueOnce({} as any);

      // Temporarily spy on/mock register.getSingleMetric
      const originalGetSingleMetric = register.getSingleMetric;
      register.getSingleMetric = vi.fn().mockImplementation((name) => {
        if (name === 'nodejs_errors_total') return undefined;
        return originalGetSingleMetric.call(register, name);
      });

      try {
        const error = new Error('Some error');
        const request: any = { method: 'GET', url: '/test', user: { id: '1' }, log: { error: vi.fn() } };
        const reply: any = { status: vi.fn().mockReturnValue({ send: vi.fn() }) };

        await expect(errorHandler(error, request, reply)).resolves.toBeUndefined();
      } finally {
        register.getSingleMetric = originalGetSingleMetric;
      }
    });
  });
});
