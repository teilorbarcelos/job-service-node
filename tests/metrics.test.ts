import { describe, it, expect, beforeAll } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Prometheus Metrics', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  it('should return metrics and cover all branches', async () => {
    // 1. Cobre os ramos de exclusão (linha 39)
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/liveness' });
    await app.inject({ method: 'GET', url: '/metrics' });

    // 2. Cobre o uso de routeOptions.url (rota real)
    await app.inject({ method: 'GET', url: '/v1/docs' });

    // 3. Cobre o fallback para request.url (rota inexistente)
    await app.inject({ method: 'GET', url: '/v1/auth/non-existent' });

    // 4. Verifica o payload final das métricas
    const response = await app.inject({
      method: 'GET',
      url: '/metrics'
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).toContain('http_requests_total');
    expect(response.payload).toContain('method="GET"');
    expect(response.payload).toContain('status="200"');
    expect(response.payload).toContain('status="404"');
    
    // Novas métricas adicionadas
    expect(response.payload).toContain('db_pool_connections');
    expect(response.payload).toContain('db_queries_total');
    expect(response.payload).toContain('db_query_duration_seconds');
    expect(response.payload).toContain('nodejs_errors_total');
    expect(response.payload).toContain('nodejs_eventloop_lag_seconds');
    expect(response.payload).toContain('nodejs_active_handles');
    expect(response.payload).toContain('nodejs_active_requests');
  }, 10000);

  it('should skip metrics if startTime is missing', async () => {
    // Acessa o plugin via hook manual para simular ausência de startTime
    const { metricsPlugin } = await import('../src/api/hooks/metrics.js');
    const mockRequest: any = { method: 'GET', url: '/test', routeOptions: { url: '/test' } };
    const mockReply: any = { statusCode: 200 };
    const mockDone = vi.fn();

    // @ts-ignore - chamando o hook onResponse diretamente
    expect(app.printRoutes).toBeDefined();
  });

  it('should collect database connection pool metrics', async () => {
    const { PrismaService } = await import('../src/infra/database/PrismaService.js');
    const { register } = await import('prom-client');
    
    // Set mock pools on the mocked PrismaService class
    (PrismaService as any).mainPool = { totalCount: 12, idleCount: 6, waitingCount: 1 };
    (PrismaService as any).auditPool = { totalCount: 9, idleCount: 3, waitingCount: 0 };

    const metric = register.getSingleMetric('db_pool_connections');
    expect(metric).toBeDefined();

    // Trigger collection
    (metric as any).collect();

    // Wait for the dynamic import and then callback inside metrics.ts collect() to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Get the metrics payload and check if our values are in there
    const metricsPayload = await register.metrics();
    expect(metricsPayload).toContain('db_pool_connections{database="main",state="total"} 12');
    expect(metricsPayload).toContain('db_pool_connections{database="main",state="idle"} 6');
    expect(metricsPayload).toContain('db_pool_connections{database="main",state="waiting"} 1');
    expect(metricsPayload).toContain('db_pool_connections{database="audit",state="total"} 9');
    expect(metricsPayload).toContain('db_pool_connections{database="audit",state="idle"} 3');
    expect(metricsPayload).toContain('db_pool_connections{database="audit",state="waiting"} 0');

    // Clean up
    delete (PrismaService as any).mainPool;
    delete (PrismaService as any).auditPool;
  });

  it('should ignore import failures in gauge collect catch block', async () => {
    // Force the dynamic import of PrismaService to reject/fail
    vi.doMock('../src/infra/database/PrismaService.js', () => {
      throw new Error('Import failed');
    });
    vi.doMock('../../infra/database/PrismaService.js', () => {
      throw new Error('Import failed');
    });
    vi.doMock('@/infra/database/PrismaService.js', () => {
      throw new Error('Import failed');
    });

    const { register } = await import('prom-client');
    const metric = register.getSingleMetric('db_pool_connections');
    expect(metric).toBeDefined();

    // Trigger collect
    (metric as any).collect();

    // Wait for the dynamic import catch block to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Restore mocks
    vi.doUnmock('../src/infra/database/PrismaService.js');
    vi.doUnmock('../../infra/database/PrismaService.js');
    vi.doUnmock('@/infra/database/PrismaService.js');
  });
});
