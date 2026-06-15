import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';
import { CONFIG } from '../../shared/config/env.js';

export class PrismaService {
  private static instance: PrismaClient;
  public static pool: Pool | null = null; // NOSONAR - mutado internamente em getClient/close/reset

  /* istanbul ignore next */
  private constructor() {}

  public static getClient(): PrismaClient {
    if (!PrismaService.instance) {
      const dbUrl = process.env.DATABASE_URL ?? CONFIG.DATABASE.URL;
      const pool = new Pool({
        connectionString: dbUrl,
        max: CONFIG.DATABASE.POOL_MAX,
        idleTimeoutMillis: CONFIG.DATABASE.POOL_IDLE_TIMEOUT,
        connectionTimeoutMillis: CONFIG.DATABASE.POOL_CONNECTION_TIMEOUT,
        query_timeout: CONFIG.DATABASE.QUERY_TIMEOUT,
      } as PoolConfig);
      PrismaService.pool = pool;
      const adapter = new PrismaPg(pool);
      PrismaService.instance = new PrismaClient({ adapter });
    }
    return PrismaService.instance;
  }

  public static async close(): Promise<void> {
    try {
      await PrismaService.pool?.end();
    } finally {
      PrismaService.pool = null;
      PrismaService.instance = undefined as unknown as PrismaClient;
    }
  }

  public static reset(): void {
    PrismaService.instance = undefined as unknown as PrismaClient;
    PrismaService.pool = null;
  }
}

export const db = PrismaService.getClient();
