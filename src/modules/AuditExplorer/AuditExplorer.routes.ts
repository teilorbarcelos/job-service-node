import { FastifyInstance } from 'fastify';
import { authenticate, authorizeAdmin } from '../../api/hooks/auth.hook.js';
import { createRouteSchema } from '../../shared/utils/schema.util.js';
import { AuditExplorerController } from './AuditExplorer.controller.js';
import { getAuditExplorerView } from './AuditExplorer.view.js';

export async function auditExplorerRoutes(fastify: FastifyInstance) {
  const controller = new AuditExplorerController();

  fastify.get('/admin/logs', {
    schema: { hide: true }
  }, async (_request, reply) => {
    return reply.type('text/html').send(getAuditExplorerView());
  });

  fastify.get('/admin/api/audit', {
    schema: createRouteSchema({
      tags: ['Audit Explorer'],
      summary: 'List audit logs',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 0 },
          size: { type: 'number', default: 15 },
          search: { type: 'string', default: '' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
            total: { type: 'number' }
          }
        }
      }
    }),
    preHandler: [authenticate, authorizeAdmin],
    handler: controller.getAuditLogs
  });

  fastify.get('/admin/api/errors', {
    schema: createRouteSchema({
      tags: ['Audit Explorer'],
      summary: 'List error logs',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 0 },
          size: { type: 'number', default: 15 },
          search: { type: 'string', default: '' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', additionalProperties: true } },
            total: { type: 'number' }
          }
        }
      }
    }),
    preHandler: [authenticate, authorizeAdmin],
    handler: controller.getErrorLogs
  });
}
