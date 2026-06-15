import { PrismaService, db, auditDb } from '../../../src/infra/database/PrismaService.js';

describe('PrismaService', () => {
  it('should return the same main client instance on multiple calls', () => {
    const instance1 = PrismaService.getMainClient();
    const instance2 = PrismaService.getMainClient();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(db);
  });

  it('should return the same audit client instance on multiple calls', () => {
    const instance1 = PrismaService.getAuditClient();
    const instance2 = PrismaService.getAuditClient();
    
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(auditDb);
  });

  it('should use fallback URL for audit client if DATABASE_URL_AUDIT is not set', () => {
    const originalUrl = process.env.DATABASE_URL_AUDIT;
    
    try {
      delete process.env.DATABASE_URL_AUDIT;
      // @ts-expect-error - accessing private field for coverage test
      PrismaService.auditInstance = null;
      
      const instance = PrismaService.getAuditClient();
      expect(instance).toBeDefined();
    } finally {
      process.env.DATABASE_URL_AUDIT = originalUrl;
    }
  });
});
