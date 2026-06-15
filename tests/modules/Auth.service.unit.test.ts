import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, parseTimeToSeconds } from '@/modules/Auth/Auth.service.js';
import { AuthRepository } from '@/modules/Auth/Auth.repository.js';
import { JWTAuthProvider } from '@/infra/auth/AuthProvider.js';
import { UnauthorizedError, NotFoundError } from '@/shared/errors/index.js';
import { emailProvider } from '@/infra/email/EmailProvider.js';
import { redis } from '@/infra/database/RedisProvider.js';
import { logger } from '@/shared/utils/logger.js';
import { bcryptPool } from '@/infra/bcrypt/BcryptPool.js';

vi.mock('@/modules/Auth/Auth.repository.js');
vi.mock('@/infra/auth/AuthProvider.js');
vi.mock('@/infra/email/EmailProvider.js');
vi.mock('@/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));
vi.mock('../../src/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue('hashed'),
  },
}));

describe('AuthService Unit', () => {
  let service: AuthService;
  let repo: any;
  let jwt: any;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new AuthRepository();
    jwt = new JWTAuthProvider({} as any);
    service = new AuthService({} as any);
    // @ts-ignore
    service.repository = repo;
    // @ts-ignore
    service.jwtProvider = jwt;
  });

  describe('login', () => {
    it('should throw UnauthorizedError if auth is null (line 43-45)', async () => {
      repo.findByEmail.mockResolvedValue(null);
      await expect(service.login('t@t.com', 'p')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if password missing (line 43-45)', async () => {
      repo.findByEmail.mockResolvedValue({ User: {} }); // Missing password
      await expect(service.login('t@t.com', 'p')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if User missing (line 43-45)', async () => {
      repo.findByEmail.mockResolvedValue({ password: 'h' }); // Missing User
      await expect(service.login('t@t.com', 'p')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if user role is disabled (line 60)', async () => {
      repo.findByEmail.mockResolvedValue({ 
        password: 'h', 
        active: true, 
        User: { active: true, Role: { active: false } } 
      });
      await expect(service.login('t@t.com', 'p')).rejects.toThrow('User role is currently disabled');
    });

    it('should throw UnauthorizedError if account locked (line 64)', async () => {
      repo.findByEmail.mockResolvedValue({ 
        password: 'h', 
        active: true, 
        retries: 5,
        User: { active: true, Role: { active: true } } 
      });
      await expect(service.login('t@t.com', 'p')).rejects.toThrow('Account locked');
    });
  });

  describe('getMe', () => {
    it('should throw UnauthorizedError if auth is null (line 103-105)', async () => {
      repo.findByEmail.mockResolvedValue(null);
      await expect(service.getMe('t@t.com')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if User missing (line 103-105)', async () => {
      repo.findByEmail.mockResolvedValue({ active: true }); // Missing User
      await expect(service.getMe('t@t.com')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if inactive (line 103-105)', async () => {
      repo.findByEmail.mockResolvedValue({ active: false, User: {} });
      await expect(service.getMe('t@t.com')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if user account is disabled (line 132)', async () => {
      repo.findByEmail.mockResolvedValue({ 
        active: true, 
        User: { active: false } 
      });
      await expect(service.getMe('t@t.com')).rejects.toThrow('User account is disabled');
    });

    it('should throw UnauthorizedError if user role is disabled (line 136)', async () => {
      repo.findByEmail.mockResolvedValue({ 
        active: true, 
        User: { active: true, Role: { active: false } } 
      });
      await expect(service.getMe('t@t.com')).rejects.toThrow('User role is currently disabled');
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedError if verifyToken fails (line 143-145)', async () => {
      jwt.verifyToken.mockRejectedValue(new Error('Invalid'));
      await expect(service.refreshToken('junk')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if session not found in redis (line 180)', async () => {
      jwt.verifyToken.mockResolvedValue({ id: 'u1', email: 't@t.com' });
      vi.mocked(redis.get).mockResolvedValue(null);
      await expect(service.refreshToken('junk')).rejects.toThrow('Sessão encerrada');
    });
  });

  describe('requestPasswordReset', () => {
    it('should resolve without throwing if user is not found (security fix)', async () => {
      repo.findByEmail.mockResolvedValue(null);
      await expect(service.requestPasswordReset('missing@test.com')).resolves.not.toThrow();
    });

    it('should log error if email fails (line 167)', async () => {
      repo.findByEmail.mockResolvedValue({ id: '1', User: { name: 'Test' } });
      vi.mocked(emailProvider.sendEmail).mockRejectedValueOnce(new Error('SMTP Fail'));
      const loggerSpy = vi.spyOn(logger, 'error');

      await service.requestPasswordReset('t@t.com');

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Erro ao enviar e-mail de recuperação');
      loggerSpy.mockRestore();
    });
  });

  describe('validateResetToken', () => {
    it('should throw NotFoundError if user not found', async () => {
      repo.findByEmail.mockResolvedValue(null);
      await expect(service.validateResetToken('t@t.com', '123')).rejects.toThrow(NotFoundError);
    });

    it('should throw UnauthorizedError if token is invalid', async () => {
      repo.findByEmail.mockResolvedValue({ request_password_token: 'wrong' });
      await expect(service.validateResetToken('t@t.com', '123')).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError if token has expired', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      repo.findByEmail.mockResolvedValue({ 
        request_password_token: '123', 
        request_password_expiration: expiredDate 
      });
      await expect(service.validateResetToken('t@t.com', '123')).rejects.toThrow(UnauthorizedError);
    });

    it('should return true if token is valid', async () => {
      const validDate = new Date(Date.now() + 10000);
      repo.findByEmail.mockResolvedValue({ 
        request_password_token: '123', 
        request_password_expiration: validDate 
      });
      const result = await service.validateResetToken('t@t.com', '123');
      expect(result).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should throw NotFoundError if user is not found (line 189)', async () => {
      repo.findByEmail.mockResolvedValue(null);
      await expect(service.resetPassword('missing@test.com', '123', 'new')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Permission Mapping (line 68, 107)', () => {
    const mockAuth = {
      id: '1',
      active: true,
      is_deleted: false,
      password: 'hashed',
      User: {
        id: 'u1',
        email: 'u@u.com',
        name: 'User',
        active: true,
        is_deleted: false,
        Role: {
          active: true,
          is_deleted: false,
          RoleFeature: [
            { id_feature: 'f1', view: true, create: false, delete: false, activate: false }
          ]
        }
      }
    };

    it('should map permissions in login', async () => {
      repo.findByEmail.mockResolvedValue(mockAuth);
      vi.mocked(bcryptPool.compare).mockResolvedValue(true as never);
      jwt.generateTokenPair.mockResolvedValue({ token: 't', refreshToken: 'r' });

      const result = await service.login('u@u.com', 'pass');
      expect(result.user.role.permissions).toHaveLength(1);
      expect(result.user.role.permissions[0].feature).toBe('f1');
    });

    it('should map permissions in getMe', async () => {
      repo.findByEmail.mockResolvedValue(mockAuth);
      jwt.generateTokenPair.mockResolvedValue({ token: 't', refreshToken: 'r' });

      const result = await service.getMe('u@u.com');
      expect(result.user.role.permissions).toHaveLength(1);
      expect(result.user.role.permissions[0].feature).toBe('f1');
    });

    it('should cover fallback empty array for permissions (line 68, 107)', async () => {
      const mockAuthNoPerms = {
        ...mockAuth,
        User: {
          ...mockAuth.User,
          Role: { ...mockAuth.User.Role, RoleFeature: null }
        }
      };
      repo.findByEmail.mockResolvedValue(mockAuthNoPerms);
      jwt.generateTokenPair.mockResolvedValue({ token: 't', refreshToken: 'r' });

      const result = await service.getMe('u@u.com');
      expect(result.user.role.permissions).toHaveLength(0);
    });

    it('should cover fallback empty array for permissions in login (line 68)', async () => {
      const mockAuthNoPerms = {
        ...mockAuth,
        User: {
          ...mockAuth.User,
          Role: { ...mockAuth.User.Role, RoleFeature: null }
        }
      };
      repo.findByEmail.mockResolvedValue(mockAuthNoPerms);
      vi.mocked(bcryptPool.compare).mockResolvedValue(true as never);
      jwt.generateTokenPair.mockResolvedValue({ token: 't', refreshToken: 'r' });

      const result = await service.login('u@u.com', 'pass');
      expect(result.user.role.permissions).toHaveLength(0);
    });
  });

  describe('parseTimeToSeconds', () => {
    it('should parse seconds', () => {
      expect(parseTimeToSeconds('30s')).toBe(30);
    });

    it('should parse minutes', () => {
      expect(parseTimeToSeconds('15m')).toBe(900);
    });

    it('should parse hours', () => {
      expect(parseTimeToSeconds('2h')).toBe(7200);
    });

    it('should parse days', () => {
      expect(parseTimeToSeconds('7d')).toBe(604800);
    });

    it('should return default for invalid format', () => {
      expect(parseTimeToSeconds('invalid')).toBe(900);
    });
  });
});
