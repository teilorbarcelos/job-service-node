import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '@/app.js';
import { db } from '@/infra/database/PrismaService.js';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {
    $queryRaw: vi.fn(),
  },
  auditDb: {
    audit: { create: vi.fn().mockResolvedValue({}) },
    errorLog: { create: vi.fn().mockResolvedValue({}) },
  }
}));

describe('Dashboard Endpoints', () => {
  const app = buildApp();
  let tokenWithPermission: string;
  let tokenWithoutPermission: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.ready();
    tokenWithPermission = app.jwt.sign({ 
      id: 'admin-id', 
      email: 'admin@test.com', 
      roleId: 'administrator',
      permissions: [
        { feature: 'dashboard', view: true, create: true, delete: true, activate: true }
      ]
    });
    tokenWithoutPermission = app.jwt.sign({ 
      id: 'user-id', 
      email: 'user@test.com', 
      roleId: 'operator',
      permissions: [
        { feature: 'dashboard', view: false, create: false, delete: false, activate: false }
      ]
    });
  });

  it('should return 403 if user lacks dashboard view permission', async () => {
    const response = await supertest(app.server)
      .get('/v1/dashboard/stats')
      .set('Authorization', `Bearer ${tokenWithoutPermission}`);

    expect(response.status).toBe(403);
  });

  it('should return 200 and stats if user has dashboard view permission', async () => {
    const mockUserStats = [{ date: '2026-05-22', count: 5 }];
    const mockProductStats = [{ date: '2026-05-22', count: 10 }];
    const mockProductsPerUser = [{ userId: 'e57922bb-685b-439c-986c-482a8bfba705', userName: 'Teilor', count: 10 }];

    (db.$queryRaw as any)
      .mockResolvedValueOnce(mockUserStats)
      .mockResolvedValueOnce(mockProductStats)
      .mockResolvedValueOnce(mockProductsPerUser);

    const response = await supertest(app.server)
      .get('/v1/dashboard/stats')
      .set('Authorization', `Bearer ${tokenWithPermission}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userCreationStats: mockUserStats,
      productCreationStats: mockProductStats,
      productsPerUser: mockProductsPerUser,
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('should handle invalid date parameters and fall back to default arrays if repository returns falsy values', async () => {
    (db.$queryRaw as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(null);

    const response = await supertest(app.server)
      .get('/v1/dashboard/stats')
      .query({ createdAt_start: 'invalid-date', createdAt_end: 'invalid-date' })
      .set('Authorization', `Bearer ${tokenWithPermission}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userCreationStats: [],
      productCreationStats: [],
      productsPerUser: [],
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('should parse valid dates and return stats', async () => {
    const mockUserStats = [{ date: '2026-05-22', count: 5 }];
    const mockProductStats = [{ date: '2026-05-22', count: 10 }];
    const mockProductsPerUser = [{ userId: 'e57922bb-685b-439c-986c-482a8bfba705', userName: 'Teilor', count: 10 }];

    (db.$queryRaw as any)
      .mockResolvedValueOnce(mockUserStats)
      .mockResolvedValueOnce(mockProductStats)
      .mockResolvedValueOnce(mockProductsPerUser);

    const response = await supertest(app.server)
      .get('/v1/dashboard/stats')
      .query({ createdAt_start: '2026-05-20', createdAt_end: '2026-05-22' })
      .set('Authorization', `Bearer ${tokenWithPermission}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      userCreationStats: mockUserStats,
      productCreationStats: mockProductStats,
      productsPerUser: mockProductsPerUser,
    });
    expect(db.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('should fall back to UTC timeZone if resolvedOptions does not provide one', async () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;
    const mockDateTimeFormat = function() {
      return {
        resolvedOptions: () => ({})
      };
    };
    // @ts-ignore
    Intl.DateTimeFormat = mockDateTimeFormat;

    try {
      (db.$queryRaw as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const response = await supertest(app.server)
        .get('/v1/dashboard/stats')
        .set('Authorization', `Bearer ${tokenWithPermission}`);

      expect(response.status).toBe(200);
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });
});
