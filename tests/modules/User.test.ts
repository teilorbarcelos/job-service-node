import supertest from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../src/app.js';
import { db } from '../../src/infra/database/PrismaService.js';
import { emailProvider } from '../../src/infra/email/EmailProvider.js';
import { logger } from '../../src/shared/utils/logger.js';

const mockRedis = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(JSON.stringify({ id: 'test-user', email: 'test@example.com', roleId: 'admin' })),
  set: vi.fn().mockResolvedValue('OK'),
  setex: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  scan: vi.fn().mockResolvedValue(['0', []]),
  ping: vi.fn().mockResolvedValue('PONG'),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
}));

vi.mock('@/infra/database/RedisProvider.js', () => ({ redis: mockRedis }));
vi.mock('../../src/infra/database/RedisProvider.js', () => ({ redis: mockRedis }));

vi.mock('../../src/infra/pdf/PdfProvider.js', () => ({
  pdfProvider: {
    generatePdf: vi.fn().mockImplementation(async () => {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([37, 80, 68, 70, 49, 50, 51])); // %PDF123
          controller.close();
        }
      });
    }),
  }
}));


describe('User Endpoints', () => {
  const app = buildApp();
  let token: string;
  const adminId = '550e8400-e29b-41d4-a716-446655440000';
  const adminEmail = 'admin@test.com';

  beforeAll(async () => {
    await app.ready();
    token = app.jwt.sign({ 
      id: adminId, 
      email: adminEmail, 
      roleId: 'administrator',
      permissions: [
        { feature: 'dashboard', view: true, create: true, delete: true, activate: true },
        { feature: 'user', view: true, create: true, delete: true, activate: true },
        { feature: 'role', view: true, create: true, delete: true, activate: true },
        { feature: 'product', view: true, create: true, delete: true, activate: true }
      ]
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /v1/user', () => {
    it('should return paginated users', async () => {
      (db.user.findMany as any).mockResolvedValue([
        { id: '1', name: 'User 1', email: 'user1@test.com', active: true },
      ]);
      (db.user.count as any).mockResolvedValue(1);

      const response = await supertest(app.server)
        .get('/v1/user')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });
  });

  describe('POST /v1/user', () => {
    it('should create a new user', async () => {
      const newUser = { id: '550e8400-e29b-41d4-a716-446655440001', name: 'New User', email: 'new@test.com', id_role: '550e8400-e29b-41d4-a716-446655440001' };
      (db.user.create as any).mockResolvedValue(newUser);

      const response = await supertest(app.server)
        .post('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          name: 'New User', 
          email: 'new@test.com', 
          id_role: '550e8400-e29b-41d4-a716-446655440001',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('New User');
      expect(db.user.create).toHaveBeenCalled();
    });

    it('should handle email failure during user creation', async () => {
      vi.spyOn(emailProvider, 'sendEmail').mockRejectedValueOnce(new Error('SMTP Error'));
      const loggerSpy = vi.spyOn(logger, 'error');

      const newUser = { id: '550e8400-e29b-41d4-a716-446655440002', name: 'New User', email: 'new@test.com', id_role: '550e8400-e29b-41d4-a716-446655440001' };
      (db.user.create as any).mockResolvedValue(newUser);

      const response = await supertest(app.server)
        .post('/v1/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          name: 'New User', 
          email: 'new@test.com', 
          id_role: '550e8400-e29b-41d4-a716-446655440001',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });

  describe('GET /v1/user/:id', () => {
    it('should return user by id', async () => {
      const user = { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Test' };
      (db.user.findUnique as any).mockResolvedValue(user);

      const response = await supertest(app.server)
        .get('/v1/user/550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('550e8400-e29b-41d4-a716-446655440003');
    });
  });

  describe('PUT /v1/user/:id', () => {
    it('should update a user', async () => {
      const updatedUser = { id: '550e8400-e29b-41d4-a716-446655440003', name: 'Updated' };
      (db.user.findUnique as any).mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440003' });
      (db.user.update as any).mockResolvedValue(updatedUser);

      const response = await supertest(app.server)
        .put('/v1/user/550e8400-e29b-41d4-a716-446655440003')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated');
    });

    it('should allow only password update for first user', async () => {
      (db.user.findUnique as any).mockResolvedValue({ id: adminId, email: 'admin@email.com', name: 'Admin' });
      (db.user.update as any).mockResolvedValue({ id: adminId, email: 'admin@email.com', name: 'Admin' });

      const response = await supertest(app.server)
        .put(`/v1/user/${adminId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacker Name', password: 'new-admin-password' });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /v1/user/:id', () => {
    it('should return 400 when trying to delete first user', async () => {
      (db.user.findUnique as any).mockResolvedValue({ id: adminId, email: 'admin@email.com' });

      const response = await supertest(app.server)
        .delete(`/v1/user/${adminId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it('should delete a normal user', async () => {
      (db.user.findUnique as any).mockResolvedValue({ id: '2', email: 'user@test.com' });
      (db.user.update as any).mockResolvedValue({ id: '2', is_deleted: true });

      const response = await supertest(app.server)
        .delete('/v1/user/2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
    });
  });

  describe('PATCH /v1/user/:id/status', () => {
    it('should toggle user status', async () => {
      (db.user.findUnique as any).mockResolvedValue({ id: '2', email: 'user@test.com' });
      (db.user.update as any).mockResolvedValue({ id: '2', active: false });

      const response = await supertest(app.server)
        .patch('/v1/user/2/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false });

      expect(response.status).toBe(200);
      expect(response.body.active).toBe(false);
    });
  });

  describe('RBAC Authorization', () => {
    it('should return 403 if user lacks permission', async () => {
      const limitedToken = app.jwt.sign({ 
        id: 'user-id', 
        email: 'limited@test.com', 
        roleId: 'role-limited',
        permissions: [
          { feature: 'dashboard', view: true }
        ]
      });

      const response = await supertest(app.server)
        .get('/v1/user')
        .set('Authorization', `Bearer ${limitedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Sem permissão para view em user');
    });

    it('should return 403 if permissions array is missing', async () => {
      const noPermsToken = app.jwt.sign({ 
        id: 'user-id', 
        email: 'noperms@test.com', 
        roleId: 'role-none'
      });

      const response = await supertest(app.server)
        .get('/v1/user')
        .set('Authorization', `Bearer ${noPermsToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /v1/user/export/pdf', () => {
    it('should return PDF stream and proper headers for authorized user', async () => {
      (db.user.findMany as any).mockResolvedValue([
        { id: '1', name: 'User 1', email: 'user1@test.com', active: true, Role: { name: 'Admin' } },
      ]);

      const response = await supertest(app.server)
        .get('/v1/user/export/pdf')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe('application/pdf');
      expect(response.header['content-disposition']).toBe('attachment; filename="usuarios.pdf"');
      expect(response.body.toString()).toContain('%PDF123');
    });

    it('should return 401 if unauthenticated', async () => {
      const response = await supertest(app.server)
        .get('/v1/user/export/pdf');

      expect(response.status).toBe(401);
    });

    it('should return 403 if unauthorized', async () => {
      const limitedToken = app.jwt.sign({ 
        id: 'user-id', 
        email: 'limited@test.com', 
        roleId: 'role-limited',
        permissions: [
          { feature: 'dashboard', view: true }
        ]
      });

      const response = await supertest(app.server)
        .get('/v1/user/export/pdf')
        .set('Authorization', `Bearer ${limitedToken}`);

      expect(response.status).toBe(403);
    });
  });
});

