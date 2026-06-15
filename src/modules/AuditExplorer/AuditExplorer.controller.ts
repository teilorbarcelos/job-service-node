import { FastifyReply, FastifyRequest } from 'fastify';
import { auditDb } from '../../infra/database/PrismaService.js';

export class AuditExplorerController {
  async getAuditLogs(request: FastifyRequest, _reply: FastifyReply) {
    /* istanbul ignore next */
    const { page = 0, size = 15, search = '' } = request.query as { page?: number; size?: number; search?: string };
    const skip = Number(page) * Number(size);
    const take = Number(size);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { user_name: { contains: search, mode: 'insensitive' } },
        { table_name: { contains: search, mode: 'insensitive' } },
        { action_type: { contains: search, mode: 'insensitive' } },
        { base_url: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      auditDb.audit.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      auditDb.audit.count({ where }),
    ]);

    return { items, total };
  }

  async getErrorLogs(request: FastifyRequest, _reply: FastifyReply) {
    /* istanbul ignore next */
    const { page = 0, size = 15, search = '' } = request.query as { page?: number; size?: number; search?: string };
    const skip = Number(page) * Number(size);
    const take = Number(size);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { source: { contains: search, mode: 'insensitive' } },
        { error_message: { contains: search, mode: 'insensitive' } },
        { error_data: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      auditDb.errorLog.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      auditDb.errorLog.count({ where }),
    ]);

    return { items, total };
  }
}
