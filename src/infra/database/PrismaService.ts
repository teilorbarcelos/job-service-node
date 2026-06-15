import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as AuditClient } from '@prisma/audit-client';
import { PrismaClient as MainClient } from '@prisma/client';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { Counter, Gauge, Histogram, register } from 'prom-client';
import { CONFIG } from '../../shared/config/env.js';

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

function instrumentPool(pool: Pool, dbName: string) {
  const dbQueriesCounter = getOrCreateCounter({
    name: 'db_queries_total',
    help: 'Total number of database queries executed',
    labelNames: ['database', 'status'],
  });

  const dbQueryDuration = getOrCreateHistogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['database', 'status'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  });

  // Patch pool.query
  const originalPoolQuery = pool.query;
  pool.query = (function(this: Pool, ...queryArgs: Parameters<Pool['query']>) {
    const startTime = process.hrtime();
    const promise = originalPoolQuery.apply(this, queryArgs) as Promise<unknown> | undefined;
    if (promise && typeof promise.then === 'function') {
      return promise.then(
        (result) => {
          const diff = process.hrtime(startTime);
          const duration = diff[0] + diff[1] / 1e9;
          dbQueriesCounter.labels(dbName, 'success').inc();
          dbQueryDuration.labels(dbName, 'success').observe(duration);
          return result;
        },
        (error) => {
          const diff = process.hrtime(startTime);
          const duration = diff[0] + diff[1] / 1e9;
          dbQueriesCounter.labels(dbName, 'error').inc();
          dbQueryDuration.labels(dbName, 'error').observe(duration);
          throw error;
        }
      );
    }
    return promise;
  } as unknown) as typeof pool.query;

  // Patch pool.connect to hook client.query
  const originalConnect = pool.connect;
  pool.connect = (async function(this: Pool, ...args: Parameters<Pool['connect']>) {
    const client = await (originalConnect.apply(this, args) as unknown as Promise<PoolClient>);
    const clientWithQuery = (client as unknown) as (PoolClient & { __instrumented?: boolean }) | undefined;
    if (clientWithQuery && !clientWithQuery.__instrumented) {
      clientWithQuery.__instrumented = true;
      const originalQuery = clientWithQuery.query;
      clientWithQuery.query = (function(this: PoolClient, ...queryArgs: Parameters<PoolClient['query']>) {
        const startTime = process.hrtime();
        const promise = originalQuery.apply(this, queryArgs) as Promise<unknown> | undefined;
        if (promise && typeof promise.then === 'function') {
          return promise.then(
            (result) => {
              const diff = process.hrtime(startTime);
              const duration = diff[0] + diff[1] / 1e9;
              dbQueriesCounter.labels(dbName, 'success').inc();
              dbQueryDuration.labels(dbName, 'success').observe(duration);
              return result;
            },
            (error) => {
              const diff = process.hrtime(startTime);
              const duration = diff[0] + diff[1] / 1e9;
              dbQueriesCounter.labels(dbName, 'error').inc();
              dbQueryDuration.labels(dbName, 'error').observe(duration);
              throw error;
            }
          );
        }
        return promise;
      } as unknown) as typeof clientWithQuery.query;
    }
    return client;
  } as unknown) as typeof pool.connect;
}

// Define gauge for connection pool
getOrCreateGauge({
  name: 'db_pool_connections',
  help: 'Number of database connections in the pool',
  labelNames: ['database', 'state'],
  collect(this: Gauge<string>) {
    if (PrismaService.mainPool) {
      this.set({ database: 'main', state: 'total' }, PrismaService.mainPool.totalCount);
      this.set({ database: 'main', state: 'idle' }, PrismaService.mainPool.idleCount);
      this.set({ database: 'main', state: 'waiting' }, PrismaService.mainPool.waitingCount);
    }
    if (PrismaService.auditPool) {
      this.set({ database: 'audit', state: 'total' }, PrismaService.auditPool.totalCount);
      this.set({ database: 'audit', state: 'idle' }, PrismaService.auditPool.idleCount);
      this.set({ database: 'audit', state: 'waiting' }, PrismaService.auditPool.waitingCount);
    }
  }
});

export class PrismaService {
  private static mainInstance: MainClient;
  private static auditInstance: AuditClient;
  public static mainPool: Pool | null = null; // NOSONAR - mutado internamente para lazy init
  public static auditPool: Pool | null = null; // NOSONAR

  private static createPool(connectionString: string): Pool {
    return new Pool({
      connectionString,
      max: CONFIG.DATABASE.POOL_MAX,
      idleTimeoutMillis: CONFIG.DATABASE.POOL_IDLE_TIMEOUT,
      connectionTimeoutMillis: CONFIG.DATABASE.POOL_CONNECTION_TIMEOUT,
      query_timeout: CONFIG.DATABASE.QUERY_TIMEOUT,
    } as PoolConfig);
  }

  public static getMainClient(): MainClient {
    if (!this.mainInstance) {
      /* istanbul ignore next */
      const dbUrl = process.env.DATABASE_URL ?? CONFIG.DATABASE.URL;
      const pool = this.createPool(dbUrl);
      this.mainPool = pool;
      instrumentPool(pool, 'main');
      const adapter = new PrismaPg(pool);
      this.mainInstance = new MainClient({ adapter });
    }
    return this.mainInstance;
  }

  public static getAuditClient(): AuditClient {
    if (!this.auditInstance) {
      /* istanbul ignore next */
      const auditUrl = process.env.DATABASE_URL_AUDIT ?? CONFIG.DATABASE.URL;
      const pool = this.createPool(auditUrl);
      this.auditPool = pool;
      instrumentPool(pool, 'audit');
      const adapter = new PrismaPg(pool, { schema: 'audit' });
      this.auditInstance = new AuditClient({ adapter });
    }
    return this.auditInstance;
  }
}

export const db = PrismaService.getMainClient();
export const auditDb = PrismaService.getAuditClient();
