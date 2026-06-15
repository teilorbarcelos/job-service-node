import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '@/app.js';
import { db } from '@/infra/database/PrismaService.js';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {
    feature: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    }
  },
  auditDb: {
    audit: { create: vi.fn().mockResolvedValue({}) },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  }
}));

describe('Feature Endpoints', () => {
  const app = buildApp();
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.ready();
    token = app.jwt.sign({ 
      id: 'admin-id', 
      email: 'admin@test.com', 
      roleId: 'role-admin',
      permissions: [
        { feature: 'feature', view: true }
      ]
    });
  });

  it('should list features', async () => {
    (db.feature.findMany as any).mockResolvedValue([{ id: 'f1', name: 'Users' }]);
    (db.feature.count as any).mockResolvedValue(1);

    const response = await supertest(app.server)
      .get('/v1/feature')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
  });
});
