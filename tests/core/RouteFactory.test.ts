import { describe, it, expect, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { 
  registerGetRoute, 
  registerPostRoute, 
  registerPutRoute, 
  registerDeleteRoute, 
  registerPatchRoute 
} from '@/core/RouteFactory.js';
import { RouteConfig } from '@/shared/utils/RouteContract.js';

describe('RouteFactory', () => {
  const fastifyMock = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  } as unknown as FastifyInstance;

  const baseConfig: RouteConfig = {
    feature: 'test',
    action: 'view',
    tag: 'Test',
    summary: 'Summary',
    response: { 200: { type: 'object' } }
  };

  it('should register GET route with and without optional schemas', () => {
    // Both present
    registerGetRoute(fastifyMock, '/test', { ...baseConfig, params: {}, querystring: {} }, vi.fn());
    // Both missing
    registerGetRoute(fastifyMock, '/test', baseConfig, vi.fn());
    expect(fastifyMock.get).toHaveBeenCalled();
  });

  it('should register POST route with and without optional schemas', () => {
    // All present
    registerPostRoute(fastifyMock, '/test', { ...baseConfig, body: {}, params: {}, querystring: {} }, vi.fn());
    // All missing
    registerPostRoute(fastifyMock, '/test', baseConfig, vi.fn());
    expect(fastifyMock.post).toHaveBeenCalled();
  });

  it('should register PUT route with and without optional schemas', () => {
    // Both present
    registerPutRoute(fastifyMock, '/test', { ...baseConfig, params: {}, body: {} }, vi.fn());
    // Both missing
    registerPutRoute(fastifyMock, '/test', baseConfig, vi.fn());
    expect(fastifyMock.put).toHaveBeenCalled();
  });

  it('should register DELETE route with and without params', () => {
    // Present
    registerDeleteRoute(fastifyMock, '/test', { ...baseConfig, params: {} }, vi.fn());
    // Missing
    registerDeleteRoute(fastifyMock, '/test', baseConfig, vi.fn());
    expect(fastifyMock.delete).toHaveBeenCalled();
  });

  it('should register PATCH route with and without optional schemas', () => {
    // Both present
    registerPatchRoute(fastifyMock, '/test', { ...baseConfig, params: {}, body: {} }, vi.fn());
    // Both missing
    registerPatchRoute(fastifyMock, '/test', baseConfig, vi.fn());
    expect(fastifyMock.patch).toHaveBeenCalled();
  });
});
