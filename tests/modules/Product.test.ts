import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { buildApp } from '@/app.js';
import { db } from '@/infra/database/PrismaService.js';

vi.mock('@/infra/database/PrismaService.js', () => ({
  db: {
    product: {
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

describe('Product Endpoints', () => {
  const app = buildApp();
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    await app.ready();
    token = app.jwt.sign({ 
      id: 'admin-id', 
      email: 'admin@test.com', 
      roleId: 'administrator',
      permissions: [
        { feature: 'product', view: true, create: true, delete: true, activate: true }
      ]
    });
  });

  it('should create a product', async () => {
    const product = { id: 'p1', name: 'Product 1', price: 100 };
    (db.product.create as any).mockResolvedValue(product);

    const response = await supertest(app.server)
      .post('/v1/product')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Product 1',
        sku: 'SKU123',
        category: 'Electronics',
        price: 100,
        stock: 10,
        description: 'Test product'
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Product 1');
  });

  it('should toggle product status', async () => {
    const product = { id: 'p1', active: false };
    (db.product.findUnique as any).mockResolvedValue({ id: 'p1' });
    (db.product.update as any).mockResolvedValue(product);

    const response = await supertest(app.server)
      .patch('/v1/product/p1/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(response.status).toBe(200);
    expect(response.body.active).toBe(false);
  });
});
