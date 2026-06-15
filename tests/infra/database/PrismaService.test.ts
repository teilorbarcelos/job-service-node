import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaService } from '@/infra/database/PrismaService.js';

vi.mock('@prisma/client', () => {
  const PrismaClientMock = vi.fn().mockImplementation(function (this: any) {
    this.$connect = vi.fn().mockResolvedValue(undefined);
    this.$disconnect = vi.fn().mockResolvedValue(undefined);
    this.$queryRaw = vi.fn();
  });
  return { PrismaClient: PrismaClientMock };
});

vi.mock('@prisma/adapter-pg', () => {
  const PrismaPgMock = vi.fn().mockImplementation(function (this: any) {});
  return { PrismaPg: PrismaPgMock };
});

vi.mock('pg', () => {
  const PoolMock = vi.fn().mockImplementation(function (this: any) {
    this.end = vi.fn().mockResolvedValue(undefined);
  });
  return { Pool: PoolMock };
});

describe('PrismaService', () => {
  beforeEach(() => {
    PrismaService.reset();
  });

  afterEach(async () => {
    await PrismaService.close();
  });

  it('deve retornar uma instância singleton de PrismaClient', () => {
    const a = PrismaService.getClient();
    const b = PrismaService.getClient();
    expect(a).toBe(b);
  });

  it('deve inicializar pool na primeira chamada', () => {
    expect(PrismaService.pool).toBeNull();
    PrismaService.getClient();
    expect(PrismaService.pool).not.toBeNull();
  });

  it('deve fechar pool e resetar instância em close', async () => {
    PrismaService.getClient();
    expect(PrismaService.pool).not.toBeNull();
    await PrismaService.close();
    expect(PrismaService.pool).toBeNull();
  });

  it('close deve tolerar pool nulo', async () => {
    await PrismaService.close();
    expect(PrismaService.pool).toBeNull();
  });
});
