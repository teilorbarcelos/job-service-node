import { FastifySchema } from 'fastify';

export interface StrictRouteSchema extends FastifySchema {
  tags: [string, ...string[]];
  summary: string;
  response: {
    [statusCode: number]: unknown;
  };
}

export function createPaginatedResponseSchema(itemSchema: unknown) {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: itemSchema
      },
      total: { type: 'number' },
      page: { type: 'number' },
      size: { type: 'number' }
    }
  };
}

export function createRouteSchema<T extends StrictRouteSchema>(schema: T): T {
  return schema;
}
