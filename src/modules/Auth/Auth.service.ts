import { RoleFeature } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { bcryptPool } from '../../infra/bcrypt/BcryptPool.js';
import { businessMetrics } from '../../shared/utils/metrics.js';
import { AuthPayload, JWTAuthProvider } from '../../infra/auth/AuthProvider.js';
import { SessionManager } from '../../infra/auth/SessionManager.js';
import { redis } from '../../infra/database/RedisProvider.js';
import { emailProvider } from '../../infra/email/EmailProvider.js';
import { NotFoundError, UnauthorizedError } from '../../shared/errors/index.js';
import { FORGOT_PASSWORD_TEMPLATE } from '../../shared/templates/email/email-templates.js';
import { logger } from '../../shared/utils/logger.js';
import { CONFIG } from '../../shared/config/env.js';
import { AuthRepository } from './Auth.repository.js';

interface LoginResult {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: { 
      id: string; 
      name: string; 
      description: string;
      permissions: Array<{
        feature: string;
        create: boolean;
        view: boolean;
        delete: boolean;
        activate: boolean;
      }>;
    };
  };
}

export class AuthService {
  private repository: AuthRepository;
  private jwtProvider: JWTAuthProvider;

  constructor(fastify: FastifyInstance) {
    this.repository = new AuthRepository();
    this.jwtProvider = new JWTAuthProvider(fastify);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const auth = await this.repository.findByEmail(email);

    if (!auth || !auth.password || !auth.User) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!auth.active || auth.is_deleted) {
      throw new UnauthorizedError('Account is disabled or removed');
    }

    if (!auth.User.active || auth.User.is_deleted) {
      throw new UnauthorizedError('User account is disabled or removed');
    }

    if (!auth.User.Role.active || auth.User.Role.is_deleted) {
      throw new UnauthorizedError('User role is currently disabled or removed');
    }

    if (auth.retries >= 5) {
      throw new UnauthorizedError('Account locked due to excessive failed attempts');
    }

    const isValid = await bcryptPool.compare(password, auth.password);
    if (!isValid) {
      businessMetrics.loginsTotal.labels('failure').inc();
      await this.repository.updateRecordDetails(auth.id, {
        retries: auth.retries + 1,
      });
      throw new UnauthorizedError('Invalid credentials');
    }

    businessMetrics.loginsTotal.labels('success').inc();

    await this.repository.updateRecordDetails(auth.id, {
      retries: 0,
      first_access: false,
    });

    const permissions = (auth.User.Role.RoleFeature || []).map((rf: RoleFeature) => ({
      feature: rf.id_feature,
      create: rf.create,
      view: rf.view,
      delete: rf.delete,
      activate: rf.activate,
    }));

    const payload: AuthPayload = {
      id: auth.User.id,
      email: auth.User.email,
      roleId: auth.User.id_role,
      permissions
    };

    const tokens = await this.jwtProvider.generateTokenPair(payload);

    const tokenHash = crypto.createHash('sha256').update(tokens.token).digest('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');

    const accessExpiresSec = parseTimeToSeconds(CONFIG.JWT.EXPIRES_IN);
    const refreshExpiresSec = parseTimeToSeconds(CONFIG.JWT.REFRESH_EXPIRES_IN);

    await Promise.all([
      redis.set(`session:user:${auth.User.id}:access:${tokenHash}`, JSON.stringify(payload), 'EX', accessExpiresSec),
      redis.set(`session:user:${auth.User.id}:refresh:${refreshTokenHash}`, JSON.stringify({ family: refreshTokenHash }), 'EX', refreshExpiresSec)
    ]);

    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: {
        id: auth.User.id,
        name: auth.User.name,
        email: auth.User.email,
        role: {
          ...auth.User.Role,
          permissions
        },
      },
    };
  }

  async getMe(email: string): Promise<LoginResult> {
    const auth = await this.repository.findByEmail(email);

    if (!auth || !auth.User || !auth.active || auth.is_deleted) {
      throw new UnauthorizedError('User not found or account is disabled/removed');
    }

    if (!auth.User.active || auth.User.is_deleted) {
      throw new UnauthorizedError('User account is disabled or removed');
    }

    if (!auth.User.Role.active || auth.User.Role.is_deleted) {
      throw new UnauthorizedError('User role is currently disabled or removed');
    }

    const permissions = (auth.User.Role.RoleFeature || []).map((rf: RoleFeature) => ({
      feature: rf.id_feature,
      create: rf.create,
      view: rf.view,
      delete: rf.delete,
      activate: rf.activate,
    }));

    const payload: AuthPayload = {
      id: auth.User.id,
      email: auth.User.email,
      roleId: auth.User.id_role,
      permissions
    };

    const tokens = await this.jwtProvider.generateTokenPair(payload);

    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: {
        id: auth.User.id,
        name: auth.User.name,
        email: auth.User.email,
        role: {
          ...auth.User.Role,
          permissions
        },
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<LoginResult> {
    try {
      const payload = await this.jwtProvider.verifyToken(refreshToken);

      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const stored = await redis.get(`session:user:${payload.id}:refresh:${refreshTokenHash}`);

      if (!stored) {
        await SessionManager.invalidateUserSessions(payload.id);
        throw new UnauthorizedError('Sessão encerrada. Por favor, faça login novamente.');
      }

      const result = await this.getMe(payload.email);

      await redis.del(`session:user:${payload.id}:refresh:${refreshTokenHash}`);

      const tokenHash = crypto.createHash('sha256').update(result.token).digest('hex');
      const newRefreshHash = crypto.createHash('sha256').update(result.refreshToken).digest('hex');

      const accessExpiresSec = parseTimeToSeconds(CONFIG.JWT.EXPIRES_IN);
      const refreshExpiresSec = parseTimeToSeconds(CONFIG.JWT.REFRESH_EXPIRES_IN);

      await Promise.all([
        redis.set(`session:user:${result.user.id}:access:${tokenHash}`, JSON.stringify(payload), 'EX', accessExpiresSec),
        redis.set(`session:user:${result.user.id}:refresh:${newRefreshHash}`, JSON.stringify({ family: refreshTokenHash }), 'EX', refreshExpiresSec),
      ]);

      return result;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const auth = await this.repository.findByEmail(email);
    if (!auth || !auth.User) {
      return;
    }

    const resetToken = crypto.randomInt(100000, 999999).toString();
    const expiration = new Date(Date.now() + 15 * 60 * 1000);

    await this.repository.updateToken(auth.id, resetToken, expiration);

    emailProvider.sendEmail({
      to: email,
      subject: 'Recuperação de Senha',
      template: FORGOT_PASSWORD_TEMPLATE,
      context: {
        name: auth.User.name,
        token: resetToken
      }
    }).catch(err => logger.error({ err }, 'Erro ao enviar e-mail de recuperação'));
  }

  async validateResetToken(email: string, token: string): Promise<boolean> {
    const auth = await this.repository.findByEmail(email);
    if (!auth) throw new NotFoundError('User not found');

    if (auth.request_password_token !== token) {
      throw new UnauthorizedError('Invalid reset token');
    }

    if (auth.request_password_expiration && auth.request_password_expiration < new Date()) {
      throw new UnauthorizedError('Reset token has expired');
    }

    return true;
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    const auth = await this.repository.findByEmail(email);
    if (!auth) throw new NotFoundError('User not found');

    await this.validateResetToken(email, token);

    const hashedPassword = await bcryptPool.hash(newPassword, CONFIG.BCRYPT_ROUNDS);

    await this.repository.updateRecordDetails(auth.id, {
      password: hashedPassword,
      request_password_token: null,
      request_password_expiration: null,
      retries: 0
    });
  }

  async logout(userId: string): Promise<void> {
    await SessionManager.invalidateUserSessions(userId);
  }
}

export function parseTimeToSeconds(time: string): number {
  const match = /^(\d+)([smhd])$/.exec(time);
  if (!match) return 900;
  const value = parseInt(match[1], 10);
  /* istanbul ignore next */
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    /* istanbul ignore next */
    default: return 900;
  }
}
