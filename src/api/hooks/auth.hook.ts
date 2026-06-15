import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { AppError, UnauthorizedError } from '../../shared/errors/index.js';
import { auditDb } from '../../infra/database/PrismaService.js';
import { AuthPayload } from '../../infra/auth/AuthProvider.js';
import { redis } from '../../infra/database/RedisProvider.js';
import { register, Counter } from 'prom-client';

interface ExtendedError extends Error {
  validation?: unknown;
  details?: unknown;
  statusCode?: number;
  error?: string;
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
    
    const user = request.user as AuthPayload;
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedError('Token not found');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const sessionKey = `session:user:${user.id}:access:${tokenHash}`;
    
    const session = await redis.get(sessionKey);
    if (!session) {
      throw new UnauthorizedError('Sessão inválida ou expirada. Faça login novamente.');
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function authorizeAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = request.user as AuthPayload | undefined;
  if (!user || user.roleId !== 'administrator') {
    throw new AppError('Apenas administradores podem acessar este recurso', 403);
  }
}

export function checkPermission(feature: string, action: 'view' | 'create' | 'delete' | 'activate') {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.user as AuthPayload | undefined;
    if (!user) throw new UnauthorizedError('Usuário não autenticado');
    
    const permission = user.permissions?.find(p => p.feature === feature);
    if (!permission?.[action]) {
      throw new AppError(`Sem permissão para ${action} em ${feature}`, 403);
    }
  };
}

export async function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user as AuthPayload | undefined;
  const extendedError = error as ExtendedError;

  const errorsTotal = register.getSingleMetric('nodejs_errors_total');
  if (errorsTotal) {
    (errorsTotal as Counter<string>).labels(error.name || 'Error').inc();
  }

  const isControlledError = extendedError.statusCode ?? !!extendedError.validation;

  if (!isControlledError || user) {
    auditDb.errorLog.create({
      data: {
        id_user: user?.id ?? null,
        source: `${request.method} ${request.url}`,
        error_message: error.message || 'Unknown Error',
        error_data: JSON.stringify({
          name: error.name,
          statusCode: extendedError.statusCode ?? 500,
          details: extendedError.details,
          validation: extendedError.validation,
          stack: error.stack
        })
      }
    }).catch((err: Error) => {
      request.log.error({ err }, '[Audit System] Falha ao salvar errorLog no banco');
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
      details: error.details,
    });
  }

  if (extendedError.validation) {
    return reply.status(422).send({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: extendedError.validation,
    });
  }

  if (extendedError.statusCode) {
    return reply.status(extendedError.statusCode).send({
      error: extendedError.error ?? error.name,
      message: error.message,
    });
  }

  request.log.error({ method: request.method, url: request.url, err: error }, '[Auth] FATAL ERROR');
  return reply.status(500).send({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
  });
}
