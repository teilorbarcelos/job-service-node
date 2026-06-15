import { buildApp } from '@/app.js';
import { auditDb, db } from '@/infra/database/PrismaService.js';
import supertest from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
  auditDb: {
    audit: { create: vi.fn().mockResolvedValue({}) },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  }
}));

describe('RBAC Middleware', () => {
  const app = buildApp();

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.ready();
  });

  it('should return 403 if feature is missing from permissions array', async () => {
    const token = app.jwt.sign({ 
      id: 'u1', 
      email: 'u1@test.com', 
      permissions: [{ feature: 'wrong-feature', view: true }] 
    });

    const response = await supertest(app.server)
      .get('/v1/user')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Sem permissão para view em user');
  });

  it('should return 403 if action is false in permissions', async () => {
    const token = app.jwt.sign({ 
      id: 'u1', 
      email: 'u1@test.com', 
      permissions: [{ feature: 'user', view: false }] 
    });

    const response = await supertest(app.server)
      .get('/v1/user')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('should return 403 if permissions array is undefined', async () => {
    const token = app.jwt.sign({ id: 'u1', email: 'u1@test.com' });

    const response = await supertest(app.server)
      .get('/v1/user')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('should return 401 if token is invalid', async () => {
    const response = await supertest(app.server)
      .get('/v1/user')
      .set('Authorization', `Bearer invalid-token`);

    expect(response.status).toBe(401);
  });

  it('should return 403 in authorizeAdmin if not administrator', async () => {
    const token = app.jwt.sign({ id: 'u1', email: 'u1@test.com', roleId: 'user' });
    
    const response = await supertest(app.server)
      .get('/admin/api/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toContain('Apenas administradores');
  });

  it('should trigger errorHandler catch block (line 58-60)', async () => {
    (auditDb.errorLog.create as any).mockRejectedValueOnce(new Error('Audit DB Down'));

    (db.user.findMany as any).mockRejectedValueOnce(new Error('Normal DB Error'));

    const token = app.jwt.sign({ id: 'u1', email: 'u1@test.com', roleId: 'administrator', permissions: [{ feature: 'user', view: true }] });
    const response = await supertest(app.server)
      .get('/v1/user')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
  });
});
