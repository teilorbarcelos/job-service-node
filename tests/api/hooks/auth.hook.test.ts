import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, errorHandler, checkPermission } from '@/api/hooks/auth.hook.js';
import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError, BadRequestError, AppError } from '@/shared/errors/index.js';
import { auditDb } from '@/infra/database/PrismaService.js';
import { redis } from '@/infra/database/RedisProvider.js';

const { mockAuditDb } = vi.hoisted(() => ({
  mockAuditDb: {
    errorLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/infra/database/PrismaService.js', () => ({
  auditDb: mockAuditDb,
}));

describe('Auth Hook - authenticate', () => {
  it('should call jwtVerify', async () => {
    const request = {
      jwtVerify: vi.fn().mockResolvedValue({}),
      headers: { authorization: 'Bearer test-token' },
      user: { id: 'test-user', email: 'test@test.com' }
    } as unknown as FastifyRequest;
    const reply = {} as FastifyReply;

    await authenticate(request, reply);
    expect(request.jwtVerify).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError if jwtVerify fails', async () => {
    const request = {
      jwtVerify: vi.fn().mockRejectedValue(new Error('JWT error')),
    } as unknown as FastifyRequest;
    const reply = {} as FastifyReply;

    await expect(authenticate(request, reply)).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError if token is not found (line 21)', async () => {
    const request = {
      jwtVerify: vi.fn().mockResolvedValue({}),
      headers: { authorization: '' },
      user: { id: 'test-user' }
    } as unknown as FastifyRequest;
    const reply = {} as FastifyReply;

    await expect(authenticate(request, reply)).rejects.toThrow('Token not found');
  });

  it('should throw UnauthorizedError if session is not found in redis (line 29)', async () => {
    vi.mocked(redis.get).mockResolvedValueOnce(null);

    const request = {
      jwtVerify: vi.fn().mockResolvedValue({}),
      headers: { authorization: 'Bearer test-token' },
      user: { id: 'test-user' }
    } as unknown as FastifyRequest;
    const reply = {} as FastifyReply;

    await expect(authenticate(request, reply)).rejects.toThrow('Sessão inválida ou expirada');
  });
});

describe('Auth Hook - checkPermission', () => {
  it('should throw UnauthorizedError if user is missing', async () => {
    const hook = checkPermission('test', 'view');
    const request = { user: undefined } as any;
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow(UnauthorizedError);
    await expect(hook(request, reply)).rejects.toThrow('Usuário não autenticado');
  });

  it('should throw AppError if user does not have permission for feature', async () => {
    const hook = checkPermission('test', 'view');
    const request = { 
      user: { permissions: [{ feature: 'other', view: true }] } 
    } as any;
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow(AppError);
    await expect(hook(request, reply)).rejects.toThrow('Sem permissão para view em test');
  });

  it('should throw AppError if user has permission for feature but not the action', async () => {
    const hook = checkPermission('test', 'create');
    const request = { 
      user: { permissions: [{ feature: 'test', view: true, create: false }] } 
    } as any;
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow(AppError);
    await expect(hook(request, reply)).rejects.toThrow('Sem permissão para create em test');
  });

  it('should allow if user has permission', async () => {
    const hook = checkPermission('test', 'view');
    const request = { 
      user: { permissions: [{ feature: 'test', view: true }] } 
    } as any;
    const reply = {} as any;

    await expect(hook(request, reply)).resolves.not.toThrow();
  });
});

describe('Auth Hook - errorHandler', () => {
  let request: any;
  let reply: any;

  beforeEach(() => {
    vi.clearAllMocks();
    request = {
      method: 'GET',
      url: '/test',
      user: { id: 'user-1' },
      log: { error: vi.fn() },
    };
    reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  it('should handle AppError and send correct response', async () => {
    const error = new BadRequestError('Bad request test', { detail: 'test' });

    await errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'BadRequestError',
      message: 'Bad request test',
      details: { detail: 'test' },
    });

    expect(auditDb.errorLog.create).toHaveBeenCalled();
  });

  it('should handle validation errors (from Fastify)', async () => {
    const error = new Error('Validation failed') as any;
    error.validation = [{ message: 'required' }];

    await errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(422);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'ValidationError',
      details: error.validation,
    }));
    expect(auditDb.errorLog.create).toHaveBeenCalled();
  });

  it('should handle unknown errors (500) and log to auditDb', async () => {
    const error = new Error('Fatal database crash');

    await errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: 'InternalServerError',
    }));
    expect(auditDb.errorLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        error_message: 'Fatal database crash',
        id_user: 'user-1',
      }),
    }));
  });

  it('should handle errors without user in request', async () => {
    request.user = undefined;
    const error = new Error('Fatal error');

    await errorHandler(error, request, reply);

    expect(auditDb.errorLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        id_user: null,
      }),
    }));
  });

  it('should log error if errorLog creation fails', async () => {
    (auditDb.errorLog.create as any).mockRejectedValueOnce(new Error('DB Fail'));

    const error = new Error('Original Error');
    request.log = { error: vi.fn() };
    await errorHandler(error, request, reply);

    await vi.waitFor(() => {
      expect(request.log.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.stringContaining('[Audit System] Falha ao salvar errorLog no banco'));
    });
  });

  it('should handle error without message', async () => {
    const error = new Error('');
    (error as any).message = undefined;

    await errorHandler(error, request, reply);

    expect(auditDb.errorLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        error_message: 'Unknown Error',
      }),
    }));
  });

  it('should handle errors with pre-defined statusCode (e.g. from plugins)', async () => {
    const error = new Error('Too many requests') as any;
    error.statusCode = 429;
    error.error = 'Too Many Requests';

    await errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'Too Many Requests',
      message: 'Too many requests',
    });
    // Deve logar no auditDb pois o usuário está autenticado
    expect(auditDb.errorLog.create).toHaveBeenCalled();
  });

  it('should handle errors with statusCode but without custom error name', async () => {
    const error = new Error('Custom error message') as any;
    error.statusCode = 400;
    error.name = 'NamedError';
    // Sem definir error.error

    await errorHandler(error, request, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: 'NamedError',
      message: 'Custom error message',
    });
  });
});
