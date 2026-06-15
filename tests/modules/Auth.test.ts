import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emailProvider } from '@/infra/email/EmailProvider.js';
import supertest from 'supertest';
import { buildApp } from '@/app.js';
import { db } from '@/infra/database/PrismaService.js';
import { logger } from '@/shared/utils/logger.js';
import { bcryptPool } from '@/infra/bcrypt/BcryptPool.js';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {
    auth: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock('@/infra/email/EmailProvider.js', () => ({
  emailProvider: {
    sendEmail: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('@/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));
vi.mock('../../src/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));

describe('Auth Endpoints', () => {
  const app = buildApp();

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.ready();
  });

  describe('POST /v1/auth/login', () => {
    it('should authenticate a user with valid credentials', async () => {
      const mockAuth = {
        id: 'auth-1',
        password: 'hashed-password',
        active: true,
        retries: 0,
        User: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          id_role: 'role-1',
          active: true,
        is_deleted: false,
        Role: { id: 'role-1', name: 'Admin', active: true, is_deleted: false, RoleFeature: [] }
        }
      };

      (db.auth.findFirst as any).mockResolvedValue(mockAuth);

      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return 401 if user data is missing (line 43-45)', async () => {
      (db.auth.findFirst as any).mockResolvedValue({ id: '1', password: 'hash' });
      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(401);
    });

    it('should return 401 if password is missing in db (line 43-45)', async () => {
      (db.auth.findFirst as any).mockResolvedValue({ id: 'auth-1', active: true, User: { id: '1' } });
      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(401);
    });

    it('should return 401 if auth is null (line 43-45)', async () => {
      (db.auth.findFirst as any).mockResolvedValue(null);
      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(401);
    });

    it('should return 401 if account is disabled', async () => {
      (db.auth.findFirst as any).mockResolvedValue({ active: false, password: 'hashed', User: { id: '1' } });
      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(401);
    });

    it('should return 401 if account is locked', async () => {
      (db.auth.findFirst as any).mockResolvedValue({ active: true, retries: 5, password: 'hashed', User: { id: '1' } });
      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(response.status).toBe(401);
    });

    it('should increment retries on invalid password', async () => {
      (db.auth.findFirst as any).mockResolvedValue({ 
        id: 'auth-1', 
        active: true, 
        is_deleted: false, 
        retries: 0, 
        password: 'hashed', 
        User: { id: '1', active: true, is_deleted: false, Role: { active: true, is_deleted: false } } 
      });
      (bcryptPool.compare as any).mockResolvedValue(false);

      const response = await supertest(app.server)
        .post('/v1/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(db.auth.update).toHaveBeenCalled();
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return current user data', async () => {
      const token = app.jwt.sign({ id: 'u1', email: 'test@example.com' });
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        active: true,
        User: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test',
          id_role: 'admin',
          active: true,
          is_deleted: false,
          Role: { id: 'admin', active: true, is_deleted: false, RoleFeature: [] }
        }
      });

      const response = await supertest(app.server)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return 401 if auth is null in getMe (line 103-105)', async () => {
      const token = app.jwt.sign({ id: 'u1', email: 'test@example.com' });
      (db.auth.findFirst as any).mockResolvedValue(null);

      const response = await supertest(app.server)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it('should return 401 if user data is missing in me (line 103-105)', async () => {
      const token = app.jwt.sign({ id: 'u1', email: 'test@example.com' });
      (db.auth.findFirst as any).mockResolvedValue({ id: 'auth-1', active: true });

      const response = await supertest(app.server)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });

    it('should return 401 if account is disabled in getMe (line 103-105)', async () => {
      const token = app.jwt.sign({ id: 'u1', email: 'test@example.com' });
      (db.auth.findFirst as any).mockResolvedValue({ id: 'auth-1', active: false, User: { id: '1' } });

      const response = await supertest(app.server)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should refresh tokens', async () => {
      const refreshToken = app.jwt.sign({ id: 'u1', email: 'test@example.com' });
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        active: true,
        User: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test',
          id_role: 'admin',
          active: true,
          is_deleted: false,
          Role: { id: 'admin', active: true, is_deleted: false, RoleFeature: [] }
        }
      });

      const response = await supertest(app.server)
        .post('/v1/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
    });

    it('should return 401 if refresh token is invalid (line 143-145)', async () => {
      const response = await supertest(app.server)
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'invalid' });

      expect(response.status).toBe(401);
    });
  });

  describe('Password Reset', () => {
    it('should request reset and handle email success', async () => {
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        email: 'test@test.com',
        User: { name: 'Test User' }
      });

      const response = await supertest(app.server)
        .post('/v1/auth/password/request')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(200);
    });

    it('should handle email failure during reset request (catch line 167)', async () => {
      const loggerSpy = vi.spyOn(logger, 'error');
      vi.spyOn(emailProvider, 'sendEmail').mockRejectedValueOnce(new Error('SMTP Error'));

      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        email: 'test@test.com',
        User: { name: 'Test' }
      });

      await supertest(app.server)
        .post('/v1/auth/password/request')
        .send({ email: 'test@test.com' });

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });

    it('should validate reset token', async () => {
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        request_password_token: '123456',
        request_password_expiration: new Date(Date.now() + 10000)
      });

      const response = await supertest(app.server)
        .post('/v1/auth/password/validate')
        .send({ email: 'test@test.com', token: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should throw error if reset token is invalid', async () => {
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        request_password_token: 'wrong',
        request_password_expiration: new Date(Date.now() + 10000)
      });
      const response = await supertest(app.server)
        .post('/v1/auth/password/validate')
        .send({ email: 'test@test.com', token: '123456' });
      expect(response.status).toBe(401);
    });

    it('should throw error if reset token has expired', async () => {
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        request_password_token: '123456',
        request_password_expiration: new Date(Date.now() - 10000)
      });
      const response = await supertest(app.server)
        .post('/v1/auth/password/validate')
        .send({ email: 'test@test.com', token: '123456' });
      expect(response.status).toBe(401);
    });

    it('should change password', async () => {
      (db.auth.findFirst as any).mockResolvedValue({
        id: 'auth-1',
        request_password_token: '123456',
        request_password_expiration: new Date(Date.now() + 10000)
      });
      const response = await supertest(app.server)
        .post('/v1/auth/password/change')
        .send({ email: 'test@test.com', token: '123456', password: 'new-password' });
      expect(response.status).toBe(200);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should logout correctly', async () => {
      const token = app.jwt.sign({ id: 'u1', email: 'test@example.com' });
      
      const response = await supertest(app.server)
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logout realizado com sucesso!');
    });
  });
});
