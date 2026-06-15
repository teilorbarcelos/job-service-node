import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '@/app.js';
import { db } from '@/infra/database/PrismaService.js';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {
    role: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    }
  },
  auditDb: {
    audit: { create: vi.fn().mockResolvedValue({}) },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  }
}));

describe('Role Endpoints', () => {
  const app = buildApp();
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.ready();
    token = app.jwt.sign({ 
      id: 'admin-id', 
      email: 'admin@test.com', 
      roleId: 'administrator',
      permissions: [
        { feature: 'role', view: true, create: true, delete: true, activate: true }
      ]
    });
  });

  it('should list roles', async () => {
    (db.role.findMany as any).mockResolvedValue([{ id: '1', name: 'Admin' }]);
    (db.role.count as any).mockResolvedValue(1);

    const response = await supertest(app.server)
      .get('/v1/role')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
  });

  it('should list ALL roles', async () => {
    (db.role.findMany as any).mockResolvedValue([{ id: '1', name: 'Admin' }]);
    (db.role.count as any).mockResolvedValue(1);

    const response = await supertest(app.server)
      .get('/v1/role/all')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
  });

  it('should get role by id', async () => {
    (db.role.findUnique as any).mockResolvedValue({ id: '1', name: 'Admin' });

    const response = await supertest(app.server)
      .get('/v1/role/1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Admin');
  });

  it('should return 404 if role not found', async () => {
    (db.role.findUnique as any).mockResolvedValue(null);

    const response = await supertest(app.server)
      .get('/v1/role/999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('should create a role', async () => {
    const newRole = { id: '2', name: 'Manager' };
    (db.role.create as any).mockResolvedValue(newRole);

    const response = await supertest(app.server)
      .post('/v1/role')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Manager',
        description: 'Manager role',
        permissions: [{ id_feature: 'product', view: true, create: true, delete: false, activate: true }]
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Manager');
  });

  it('should update a role', async () => {
    (db.role.findUnique as any).mockResolvedValue({ id: '1' });
    (db.role.update as any).mockResolvedValue({ id: '1', name: 'Updated' });
    (db.user.findMany as any).mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);

    const response = await supertest(app.server)
      .put('/v1/role/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ 
        name: 'Updated',
        permissions: [{ id_feature: 'product', view: true, create: true, delete: true, activate: true }]
      });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated');
    expect(db.role.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        RoleFeature: expect.objectContaining({
          create: expect.any(Array)
        })
      })
    }));
  });

  it('should update a role without permissions (branch coverage line 48)', async () => {
    (db.role.findUnique as any).mockResolvedValue({ id: '1' });
    (db.role.update as any).mockResolvedValue({ id: '1', name: 'Updated' });

    const response = await supertest(app.server)
      .put('/v1/role/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(response.status).toBe(200);
    expect(db.role.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({
        RoleFeature: expect.anything()
      })
    }));
  });

  it('should delete a role', async () => {
    (db.role.findUnique as any).mockResolvedValue({ id: '1' });
    (db.role.update as any).mockResolvedValue({ id: '1', is_deleted: true });

    const response = await supertest(app.server)
      .delete('/v1/role/1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
  });

  it('should toggle role status', async () => {
    (db.role.findUnique as any).mockResolvedValue({ id: '1' });
    (db.role.update as any).mockResolvedValue({ id: '1', active: false });

    const response = await supertest(app.server)
      .patch('/v1/role/1/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);
  });

  it('should list available features', async () => {
    (db as any).feature = { findMany: vi.fn().mockResolvedValue([{ id: 'f1', name: 'Dashboard' }]) };

    const response = await supertest(app.server)
      .get('/v1/role/features')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});
