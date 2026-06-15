import { FastifyInstance } from 'fastify';
import { AuthService } from './Auth.service.js';
import { createRouteSchema } from '../../shared/utils/schema.util.js';
import { LoginSchema, RequestResetSchema, ValidateResetSchema, ChangePasswordSchema, AuthResponseSchema, RefreshSchema } from './Auth.schema.js';
import { AuthPayload } from '../../infra/auth/AuthProvider.js';
import { authenticate } from '../../api/hooks/auth.hook.js';

interface LoginBody {
  email: string;
  password: string;
}

interface ResetRequestBody {
  email: string;
}

interface ResetValidateBody {
  email: string;
  token: string;
}

interface ChangePasswordBody {
  email: string;
  token: string;
  password: string;
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new AuthService(fastify);

  fastify.post<{ Body: LoginBody }>('/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Authenticate User',
      body: LoginSchema,
      response: { 200: AuthResponseSchema }
    })
  }, async (request, reply) => {
    const { email, password } = request.body;
    const result = await service.login(email, password);
    return reply.send(result);
  });

  fastify.post<{ Body: { refreshToken: string } }>('/auth/refresh', {
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Refresh Session Token',
      body: RefreshSchema,
      response: { 200: AuthResponseSchema }
    })
  }, async (request, reply) => {
    const { refreshToken } = request.body;
    const result = await service.refreshToken(refreshToken);
    return reply.send(result);
  });

  fastify.get('/auth/me', {
    preValidation: [authenticate],
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Get Current Logged User (Me)',
      response: { 200: AuthResponseSchema }
    })
  }, async (request, reply) => {
    const user = request.user as AuthPayload;
    const result = await service.getMe(user.email);
    return reply.send(result);
  });

  fastify.post<{ Body: ResetRequestBody }>('/auth/password/request', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Request Password Reset (Sends Email)',
      body: RequestResetSchema,
      response: { 200: { type: 'object', properties: { message: { type: 'string' } } } }
    })
  }, async (request, reply) => {
    const { email } = request.body;
    await service.requestPasswordReset(email);
    return reply.send({ message: 'E-mail de recuperação enviado com sucesso!' });
  });

  fastify.post<{ Body: ResetValidateBody }>('/auth/password/validate', {
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Validate Reset Token',
      body: ValidateResetSchema,
      response: { 200: AuthResponseSchema }
    })
  }, async (request, reply) => {
    const { email, token } = request.body;
    await service.validateResetToken(email, token);
    return reply.send({ valid: true });
  });

  fastify.post<{ Body: ChangePasswordBody }>('/auth/password/change', {
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Change Password (Reset)',
      body: ChangePasswordSchema,
      response: { 200: { type: 'object', properties: { message: { type: 'string' } } } }
    })
  }, async (request, reply) => {
    const { email, token, password } = request.body;
    await service.resetPassword(email, token, password);
    return reply.send({ message: 'Senha alterada com sucesso!' });
  });

  fastify.post('/auth/logout', {
    preValidation: [authenticate],
    schema: createRouteSchema({
      tags: ['Auth'],
      summary: 'Logout (Invalidate Session)',
      response: { 200: { type: 'object', properties: { message: { type: 'string' } } } }
    })
  }, async (request, reply) => {
    const user = request.user as AuthPayload;
    await service.logout(user.id);
    return reply.send({ message: 'Logout realizado com sucesso!' });
  });
}
