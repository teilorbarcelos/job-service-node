import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as MainClient } from '@prisma/client';
import { PrismaClient as AuditClient } from '@prisma/audit-client';

// Mock dependencies with regular functions for constructors
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(function() { return {}; }),
}));
vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation(function() { return {}; }),
}));
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(function() { return {}; }),
}));
vi.mock('@prisma/audit-client', () => ({
  PrismaClient: vi.fn().mockImplementation(function() { return {}; }),
}));

describe('PrismaService Unit', () => {
  const originalEnv = process.env.DATABASE_URL_AUDIT;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.DATABASE_URL_AUDIT = originalEnv;
  });

  it('should initialize main client and audit client', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    
    // Reset singleton instances
    PrismaService.mainInstance = null;
    PrismaService.auditInstance = null;
    
    const main = PrismaService.getMainClient();
    const audit = PrismaService.getAuditClient();
    
    expect(Pool).toHaveBeenCalled();
    expect(PrismaPg).toHaveBeenCalled();
    expect(MainClient).toHaveBeenCalled();
    expect(AuditClient).toHaveBeenCalled();
    expect(main).toBeDefined();
    expect(audit).toBeDefined();
  });

  it('should return same instances (singleton)', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    PrismaService.mainInstance = null;
    PrismaService.auditInstance = null;
    
    const main1 = PrismaService.getMainClient();
    const main2 = PrismaService.getMainClient();
    const audit1 = PrismaService.getAuditClient();
    const audit2 = PrismaService.getAuditClient();
    
    expect(main1).toBe(main2);
    expect(audit1).toBe(audit2);
    expect(MainClient).toHaveBeenCalledTimes(1);
    expect(AuditClient).toHaveBeenCalledTimes(1);
  });

  it('should use DATABASE_URL_AUDIT if provided (line 22 branch)', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    PrismaService.auditInstance = null;
    
    process.env.DATABASE_URL_AUDIT = 'postgres://audit:pass@localhost:5432/audit';
    
    PrismaService.getAuditClient();
    
    expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
      connectionString: 'postgres://audit:pass@localhost:5432/audit',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }));
  });

  it('should fallback to default URL for audit if env is missing (line 22 branch)', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    PrismaService.auditInstance = null;
    
    delete process.env.DATABASE_URL_AUDIT;
    
    PrismaService.getAuditClient();
    
    // Should use CONFIG.DATABASE.URL
    expect(Pool).toHaveBeenCalled();
  });

  it('should instrument pool.query and cover all promise branches (resolving, rejecting, non-promise)', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    PrismaService.mainInstance = null;

    const mockQuery = vi.fn();
    vi.mocked(Pool).mockImplementationOnce(function(this: any) {
      this.query = mockQuery;
      return this;
    } as any);

    // This will trigger main client creation, instantiating Pool and calling instrumentPool(pool)
    PrismaService.getMainClient();

    const poolInstance = PrismaService.mainPool;
    expect(poolInstance).toBeDefined();
    expect(poolInstance.query).toBeDefined();

    // 1. Success query (promise resolves)
    mockQuery.mockResolvedValueOnce({ rows: [1, 2, 3] });
    const res = await poolInstance.query('SELECT 1');
    expect(res).toEqual({ rows: [1, 2, 3] });

    // 2. Failure query (promise rejects)
    const testError = new Error('Database connection failed');
    mockQuery.mockRejectedValueOnce(testError);
    await expect(poolInstance.query('SELECT 1')).rejects.toThrow('Database connection failed');

    // 3. Query returning a non-promise value (e.g. undefined or standard value)
    mockQuery.mockReturnValueOnce({ rows: [] });
    const nonPromiseRes = poolInstance.query('SELECT 1');
    expect(nonPromiseRes).toEqual({ rows: [] });
  });

  it('should instrument pool.connect and client.query wrapping including double-instrumentation guard and all query branches', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    PrismaService.mainInstance = null;

    const clientQuery = vi.fn();
    const mockClient = {
      query: clientQuery
    };
    const mockConnect = vi.fn().mockResolvedValue(mockClient);

    vi.mocked(Pool).mockImplementationOnce(function(this: any) {
      this.connect = mockConnect;
      return this;
    } as any);

    PrismaService.getMainClient();
    const poolInstance = PrismaService.mainPool;

    // Connect first time
    const client1 = await poolInstance.connect();
    expect(client1).toBe(mockClient);
    expect(client1.__instrumented).toBe(true);
    expect(client1.query).toBeDefined();

    // 1. Client query resolves successfully
    clientQuery.mockResolvedValueOnce('client-query-success');
    const q1 = await client1.query('SELECT 2');
    expect(q1).toBe('client-query-success');

    // 2. Client query rejects
    clientQuery.mockRejectedValueOnce(new Error('Client error'));
    await expect(client1.query('SELECT 2')).rejects.toThrow('Client error');

    // 3. Client query returns non-promise
    clientQuery.mockReturnValueOnce('non-promise-value');
    const q3 = client1.query('SELECT 2');
    expect(q3).toBe('non-promise-value');

    // Connect second time to verify the __instrumented guard branch is taken and doesn't re-instrument
    const client2 = await poolInstance.connect();
    expect(client2).toBe(mockClient);
    expect(client2.__instrumented).toBe(true);
  });

  it('should collect database connections metric using the gauge collect method defined in PrismaService', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    const { register } = await import('prom-client');

    // Set mainPool and auditPool on PrismaService
    PrismaService.mainPool = { totalCount: 15, idleCount: 7, waitingCount: 3 } as any;
    PrismaService.auditPool = { totalCount: 11, idleCount: 4, waitingCount: 2 } as any;

    const metric = register.getSingleMetric('db_pool_connections');
    expect(metric).toBeDefined();

    // Trigger collection
    (metric as any).collect();

    const metricsPayload = await register.metrics();
    expect(metricsPayload).toContain('db_pool_connections{database="main",state="total"} 15');
    expect(metricsPayload).toContain('db_pool_connections{database="main",state="idle"} 7');
    expect(metricsPayload).toContain('db_pool_connections{database="main",state="waiting"} 3');
    expect(metricsPayload).toContain('db_pool_connections{database="audit",state="total"} 11');
    expect(metricsPayload).toContain('db_pool_connections{database="audit",state="idle"} 4');
    expect(metricsPayload).toContain('db_pool_connections{database="audit",state="waiting"} 2');

    // Clean up
    PrismaService.mainPool = null;
    PrismaService.auditPool = null;
  });

  it('should collect database connections metric when pools are null', async () => {
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    const { register } = await import('prom-client');

    PrismaService.mainPool = null;
    PrismaService.auditPool = null;

    const metric = register.getSingleMetric('db_pool_connections');
    expect(metric).toBeDefined();

    // Trigger collection
    (metric as any).collect();

    // Verification that it didn't throw and worked
    const metricsPayload = await register.metrics();
    expect(metricsPayload).toBeDefined();
  });

  it('should cover getOrCreateGauge returning existing gauge', async () => {
    const { register, Gauge } = await import('prom-client');
    // Pre-register db_pool_connections if not already registered
    if (!register.getSingleMetric('db_pool_connections')) {
      new Gauge({
        name: 'db_pool_connections',
        help: 'Number of database connections in the pool',
        labelNames: ['database', 'state'],
      });
    }
    // Reset module cache and import to trigger module-level gauge initialization with existing gauge
    vi.resetModules();
    const { PrismaService } = await vi.importActual<any>('@/infra/database/PrismaService.js');
    expect(PrismaService).toBeDefined();
  });
});
