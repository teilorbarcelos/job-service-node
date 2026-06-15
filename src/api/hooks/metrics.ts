import { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from 'prom-client';

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: [number, number];
  }
}

function getOrCreateCounter(config: { name: string; help: string; labelNames: string[] }): Counter<string> {
  const existing = register.getSingleMetric(config.name);
  if (existing) return existing as Counter<string>;
  return new Counter(config);
}

function getOrCreateGauge(config: { name: string; help: string; labelNames: string[]; collect?: () => void }): Gauge<string> {
  const existing = register.getSingleMetric(config.name);
  if (existing) return existing as Gauge<string>;
  return new Gauge(config);
}

function getOrCreateHistogram(config: { name: string; help: string; labelNames: string[]; buckets?: number[] }): Histogram<string> {
  const existing = register.getSingleMetric(config.name);
  if (existing) return existing as Histogram<string>;
  return new Histogram(config);
}

function getOrCreateMetrics() {
  if (!register.getSingleMetric('process_cpu_user_seconds_total')) {
    collectDefaultMetrics({ register });
  }

  const requestsTotal = getOrCreateCounter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
  });

  const requestDuration = getOrCreateHistogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });

  const errorsTotal = getOrCreateCounter({
    name: 'nodejs_errors_total',
    help: 'Total number of application errors/exceptions',
    labelNames: ['type'],
  });

  // DB Metrics pre-registered
  getOrCreateCounter({
    name: 'db_queries_total',
    help: 'Total number of database queries executed',
    labelNames: ['database', 'status'],
  });

  getOrCreateHistogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['database', 'status'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  getOrCreateGauge({
    name: 'db_pool_connections',
    help: 'Number of database connections in the pool',
    labelNames: ['database', 'state'],
    collect(this: Gauge<string>) {
      // Dynamic import to avoid circular dependencies and test environment mock issues
      import('../../infra/database/PrismaService.js')
        .then(({ PrismaService }) => {
          if (PrismaService?.mainPool) {
            this.set({ database: 'main', state: 'total' }, PrismaService.mainPool.totalCount);
            this.set({ database: 'main', state: 'idle' }, PrismaService.mainPool.idleCount);
            this.set({ database: 'main', state: 'waiting' }, PrismaService.mainPool.waitingCount);
          }
          if (PrismaService?.auditPool) {
            this.set({ database: 'audit', state: 'total' }, PrismaService.auditPool.totalCount);
            this.set({ database: 'audit', state: 'idle' }, PrismaService.auditPool.idleCount);
            this.set({ database: 'audit', state: 'waiting' }, PrismaService.auditPool.waitingCount);
          }
        })
        .catch(() => {
          // Ignore import failures (e.g. in test suite where mock objects are loaded)
        });
    }
  });

  return { requestsTotal, requestDuration, errorsTotal };
}

export const metricsPlugin = fp(async (app: FastifyInstance) => {
  const { requestsTotal, requestDuration } = getOrCreateMetrics();

  app.addHook('onRequest', (request: FastifyRequest, _reply, done) => {
    request.startTime = process.hrtime();
    done();
  });

  app.addHook('onResponse', (request: FastifyRequest, reply, done) => {
    // Evitar métricas para o próprio endpoint de métricas e health
    if (request.url === '/metrics' || request.url === '/health' || request.url === '/liveness') {
      return done();
    }

    const method = request.method;
    const path = request.routeOptions?.url ?? request.url;
    const status = reply.statusCode.toString();
    
    /* istanbul ignore next */
    if (request.startTime) {
      const diff = process.hrtime(request.startTime);
      const duration = diff[0] + diff[1] / 1e9;
      requestsTotal.labels(method, path, status).inc();
      requestDuration.labels(method, path, status).observe(duration);
    }
    done();
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', register.contentType);
    return await register.metrics();
  });
});

