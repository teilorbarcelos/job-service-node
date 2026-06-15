import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditLogHook, setAuditBuffer } from '@/api/hooks/audit.hook.js';

const mockPush = vi.fn();

beforeEach(() => {
  setAuditBuffer({ push: mockPush });
});

describe('Audit Hook', () => {
  let request: any;
  let reply: any;

  beforeEach(() => {
    vi.clearAllMocks();
    request = {
      method: 'POST',
      url: '/v1/users',
      hostname: 'localhost',
      ip: '127.0.0.1',
      headers: { host: 'localhost:8888' },
      user: { id: 'user-1', email: 'test@example.com' },
      body: { name: 'New User', password: 'secretpassword' },
      routeOptions: { url: '/v1/users' },
      log: { error: vi.fn() },
    };
    reply = {
      statusCode: 201,
    };
  });

  it('should sanitize sensitive fields before pushing to buffer', () => {
    auditLogHook(request, reply);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.stringContaining('******'),
    }));
    const callArgs = mockPush.mock.calls[0][0];
    const params = JSON.parse(callArgs.params);
    expect(params.password).toBe('******');
    expect(params.name).toBe('New User');
  });

  it('should NOT push excluded routes to buffer', () => {
    request.url = '/health';
    auditLogHook(request, reply);
    expect(mockPush).not.toHaveBeenCalled();

    request.url = '/v1/auth/login';
    auditLogHook(request, reply);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should NOT push OPTIONS requests', () => {
    request.method = 'OPTIONS';
    auditLogHook(request, reply);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should push even if user is not authenticated', () => {
    request.user = undefined;
    auditLogHook(request, reply);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      id_user: null,
      user_name: 'Anonymous',
    }));
  });

  it('should capture status code from reply', () => {
    reply.statusCode = 400;
    auditLogHook(request, reply);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      diff_value: JSON.stringify({ statusCode: 400 }),
    }));
  });

  it('should handle missing body and headers', () => {
    request.body = null;
    request.headers = {};
    request.routeOptions = undefined;

    auditLogHook(request, reply);
    expect(mockPush).toHaveBeenCalled();
  });

  it('should sanitize all sensitive fields', () => {
    request.body = {
      password: '1',
      newPassword: '2',
      currentPassword: '3',
      token: '4',
      refreshToken: '5'
    };

    auditLogHook(request, reply);
    const callArgs = mockPush.mock.calls[0][0];
    const params = JSON.parse(callArgs.params);
    expect(params.password).toBe('******');
    expect(params.newPassword).toBe('******');
    expect(params.currentPassword).toBe('******');
    expect(params.token).toBe('******');
    expect(params.refreshToken).toBe('******');
  });

  it('should handle non-object body in sanitize', () => {
    request.body = 'not-an-object';
    auditLogHook(request, reply);
    expect(mockPush).toHaveBeenCalled();
  });

  it('should handle critical error inside hook', () => {
    const badRequest = {
      method: 'POST',
      get url() { throw new Error('Cannot read url'); },
      log: { error: vi.fn() },
    } as any;
    auditLogHook(badRequest, reply);

    expect(badRequest.log.error).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), expect.stringContaining('[Audit System] Erro interno crítico'));
  });

  it('should fallback to System if URL is short', () => {
    request.routeOptions.url = '/v1';
    auditLogHook(request, reply);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      class: 'System',
    }));
  });

  it('should capture raw body, table_name and diff_value from payload', () => {
    const payload = JSON.stringify({ id: 'user-1', name: 'New User' });
    request.routeOptions.schema = { tags: ['User'] };

    auditLogHook(request, reply, payload);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      raw: JSON.stringify({ ...request.body, password: '******' }),
      table_name: 'User',
      diff_value: JSON.stringify({ id: 'user-1', name: 'New User' }),
    }));
  });

  it('should handle Uint8Array payload correctly', () => {
    const data = { message: 'Uint8Array test' };
    const payload = new TextEncoder().encode(JSON.stringify(data));

    auditLogHook(request, reply, payload);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      diff_value: JSON.stringify(data),
    }));
  });

  it('should handle invalid JSON payload gracefully', () => {
    const payload = 'invalid-json';

    auditLogHook(request, reply, payload);

    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({
      diff_value: JSON.stringify(payload),
    }));
  });

  it('should work without auditBuffer set (null check)', () => {
    setAuditBuffer(null as any);

    expect(() => auditLogHook(request, reply)).not.toThrow();
  });
});
