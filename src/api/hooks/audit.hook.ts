import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthPayload } from '../../infra/auth/AuthProvider.js';

const SENSITIVE_MASK = '******';

let auditBuffer: { push: (entry: Record<string, unknown>) => void } | null = null;

export function setAuditBuffer(buffer: typeof auditBuffer): void {
  auditBuffer = buffer;
}

function sanitize(data: unknown): unknown {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  const clone = { ...(data as Record<string, unknown>) };

  if (clone.password) clone.password = SENSITIVE_MASK;
  if (clone.newPassword) clone.newPassword = SENSITIVE_MASK;
  if (clone.currentPassword) clone.currentPassword = SENSITIVE_MASK;
  if (clone.token) clone.token = SENSITIVE_MASK;
  if (clone.refreshToken) clone.refreshToken = SENSITIVE_MASK;

  return clone;
}

type AuditPayload = string | Buffer | Uint8Array | null;

function buildAuditEntry(request: FastifyRequest, reply: FastifyReply, payload: AuditPayload): Record<string, unknown> | null {
  const excludedRoutes = [
    '/v1/auth/login',
    '/v1/auth/refresh',
    '/v1/auth/me',
    '/admin',
    '/health',
    '/liveness',
    '/docs',
    '/metrics'
  ];

  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(request.method) || excludedRoutes.some(route => request.url.startsWith(route)) || request.method === 'OPTIONS') {
    return null;
  }

  const user = request.user as AuthPayload | undefined;
  const body = request.body;
  const safeBody = sanitize(body);

  const routeSchema = request.routeOptions?.schema as { tags?: string[] } | undefined;
  const tableName = routeSchema?.tags?.[0] ?? 'System';

  let diffValue = payload;
  try {
    if (typeof payload === 'string') {
      diffValue = JSON.parse(payload);
    } else if (payload instanceof Uint8Array) {
      diffValue = JSON.parse(new TextDecoder().decode(payload));
    }
  } catch {
    request.log.error('[Audit System] Falha ao parsear payload do hook');
  }

  return {
    id_user: user?.id ?? null,
    user_name: user?.email ?? 'Anonymous',
    action_type: 'HTTP_REQUEST',
    execute_type: request.method,
    method: request.method,
    class: tableName,
    function: request.routeOptions?.url ?? request.url,
    params: safeBody ? JSON.stringify(safeBody) : null,
    raw: safeBody ? JSON.stringify(safeBody) : null,
    table_name: tableName,
    diff_value: diffValue ? JSON.stringify(diffValue) : JSON.stringify({ statusCode: reply.statusCode }),
    host: request.headers.host ?? null,
    ip: request.ip,
    base_url: request.url,
    hostname: request.hostname,
    original_url: (request as unknown as { originalUrl?: string }).originalUrl ?? request.url,
  };
}

export async function auditLogHook(request: FastifyRequest, reply: FastifyReply, payload: AuditPayload = null): Promise<AuditPayload> {
  try {
    const entry = buildAuditEntry(request, reply, payload);
    if (entry && auditBuffer) {
      auditBuffer.push(entry);
    }
  } catch (e) {
    request.log.error({ err: e }, '[Audit System] Erro interno crítico durante o processamento do Hook');
  }

  return payload;
}
