import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { auditDb } from '../../src/infra/database/PrismaService.js';
import supertest from 'supertest';

vi.mock('../../src/infra/database/PrismaService.js', () => ({
  auditDb: {
    audit: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
    errorLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    },
  },
  db: {
    user: {
      findUnique: vi.fn(),
    }
  },
  PrismaService: {
    getMainClient: vi.fn(),
    getAuditClient: vi.fn(),
  }
}));

describe('AuditExplorer', () => {
  let app: any;
  let token: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    token = app.jwt.sign({ id: '1', email: 'admin@test.com', roleId: 'administrator' });
  });

  describe('GET /admin/logs', () => {
    it('should return the HTML view', async () => {
      const response = await supertest(app.server).get('/admin/logs');
      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('Audit Explorer');
    });
  });

  describe('GET /admin/api/audit', () => {
    it('should return 401 if not authenticated', async () => {
      const response = await supertest(app.server).get('/admin/api/audit');
      expect(response.status).toBe(401);
    });

    it('should return 403 if not admin', async () => {
      const normalToken = app.jwt.sign({ id: '2', email: 'user@test.com', roleId: 'user' });
      const response = await supertest(app.server)
        .get('/admin/api/audit')
        .set('Authorization', `Bearer ${normalToken}`);
      expect(response.status).toBe(403);
    });

    it('should return audit logs if admin (with search)', async () => {
      (auditDb.audit.findMany as any).mockResolvedValue([{ id: '1', user_name: 'admin' }] as any);
      (auditDb.audit.count as any).mockResolvedValue(1);

      const response = await supertest(app.server)
        .get('/admin/api/audit')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
    });

    it('should return audit logs if admin (without search)', async () => {
      (auditDb.audit.findMany as any).mockResolvedValue([] as any);
      (auditDb.audit.count as any).mockResolvedValue(0);

      const response = await supertest(app.server)
        .get('/admin/api/audit')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
    });
  });

  describe('GET /admin/api/errors', () => {
    it('should return error logs if admin (with search)', async () => {
      (auditDb.errorLog.findMany as any).mockResolvedValue([{ id: '1', error_message: 'fail' }] as any);
      (auditDb.errorLog.count as any).mockResolvedValue(1);

      const response = await supertest(app.server)
        .get('/admin/api/errors')
        .set('Authorization', `Bearer ${token}`)
        .query({ search: 'fail' });

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
    });

    it('should return error logs if admin (without search)', async () => {
      (auditDb.errorLog.findMany as any).mockResolvedValue([] as any);
      (auditDb.errorLog.count as any).mockResolvedValue(0);

      const response = await supertest(app.server)
        .get('/admin/api/errors')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(0);
    });

    it('should use default query parameters if not provided', async () => {
      (auditDb.errorLog.findMany as any).mockResolvedValue([]);
      (auditDb.errorLog.count as any).mockResolvedValue(0);

      const response = await supertest(app.server)
        .get('/admin/api/errors')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(auditDb.errorLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
        skip: 0,
        take: 15
      }));
    });
  });
});
