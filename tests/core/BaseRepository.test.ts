import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository } from '@/core/BaseRepository.js';

describe('BaseRepository', () => {
  const mockDelegate = {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  class TestRepository extends BaseRepository<any, any, any, any> {
    constructor() {
      super(mockDelegate as any, 'Test');
    }
  }

  const repo = new TestRepository();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check if records exist by ids', async () => {
    mockDelegate.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);

    const result = await repo.existsById(['1', '2', '3']);

    expect(result.exists).toEqual(['1', '2']);
    expect(result.missing).toEqual(['3']);
  });

  it('should activate a record', async () => {
    mockDelegate.update.mockResolvedValue({ id: '1', active: true });

    const result = await repo.activateRecord('1');

    expect(result.active).toBe(true);
    expect(mockDelegate.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { active: true }
    }));
  });

  it('should soft delete a record', async () => {
    mockDelegate.update.mockResolvedValue({ id: '1', is_deleted: true });

    const _result = await repo.softDeleteRecord('1');

    expect(mockDelegate.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ is_deleted: true })
    }));
  });

  it('should find one by query', async () => {
    (mockDelegate as any).findFirst = vi.fn().mockResolvedValue({ id: '1' });
    const result = await repo.findOneByQuery({ email: 'test@test.com' });
    expect(result).toEqual({ id: '1' });
    expect((mockDelegate as any).findFirst).toHaveBeenCalled();
  });

  it('should throw error if findFirst is missing', async () => {
    (mockDelegate as any).findFirst = undefined;
    await expect(repo.findOneByQuery({})).rejects.toThrow('findFirst not available on Test');
  });

  it('should persist many records', async () => {
    (mockDelegate as any).createMany = vi.fn().mockResolvedValue({ count: 2 });
    const result = await repo.persistMany([{ name: '1' }, { name: '2' }]);
    expect(result.count).toBe(2);
  });

  it('should throw error if createMany is missing', async () => {
    (mockDelegate as any).createMany = undefined;
    await expect(repo.persistMany([])).rejects.toThrow('createMany not available on Test');
  });

  it('should count records', async () => {
    mockDelegate.count.mockResolvedValue(5);
    const result = await repo.countRecords();
    expect(result).toBe(5);
    expect(mockDelegate.count).toHaveBeenCalled();
  });

  it('should find one by id with include', async () => {
    mockDelegate.findUnique.mockResolvedValue({ id: '1' });
    await repo.findOneById('1', { profile: true });
    expect(mockDelegate.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: { profile: true }
    }));
  });

  it('should search paginated with filters and ordering', async () => {
    mockDelegate.findMany.mockResolvedValue([{ id: '1' }]);
    mockDelegate.count.mockResolvedValue(1);

    const result = await repo.searchPaginated(
      { page: 1, size: 5 },
      { name: 'test' },
      { roles: true },
      { orderBy: 'name', orderDirection: 'desc' }
    );

    expect(result.items).toHaveLength(1);
    expect(mockDelegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 5,
      take: 5,
      include: { roles: true },
      orderBy: { name: 'desc' }
    }));
  });

  it('should use default ordering if not provided', async () => {
    mockDelegate.findMany.mockResolvedValue([]);
    mockDelegate.count.mockResolvedValue(0);

    await repo.searchPaginated({ page: 0, size: 10 });

    expect(mockDelegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { created_at: 'desc' }
    }));
  });

  it('should find one by query with include', async () => {
    (mockDelegate as any).findFirst = vi.fn().mockResolvedValue({ id: '1' });
    await repo.findOneByQuery({}, { profile: true });
    expect((mockDelegate as any).findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: { profile: true }
    }));
  });

  it('should use default orderDirection if only orderBy is provided', async () => {
    mockDelegate.findMany.mockResolvedValue([]);
    mockDelegate.count.mockResolvedValue(0);

    await repo.searchPaginated({ page: 0, size: 10 }, {}, undefined, { orderBy: 'name' });

    expect(mockDelegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { name: 'asc' }
    }));
  });

  it('should apply default active:true and is_deleted:false filters', async () => {
    mockDelegate.findMany.mockResolvedValue([]);
    mockDelegate.count.mockResolvedValue(0);

    await repo.searchPaginated({ page: 0, size: 10 });

    expect(mockDelegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ active: true }),
          expect.objectContaining({ is_deleted: false })
        ])
      })
    }));
  });

  it('should throw BadRequestError when Prisma returns Unknown field error', async () => {
    mockDelegate.findMany.mockRejectedValue(new Error('Unknown field "invalid_field" on model "Test"'));
    await expect(repo.searchPaginated({ page: 0, size: 10 }, {}, undefined, { orderBy: 'invalid_field' }))
      .rejects.toThrow('Falha na busca/ordenação');
  });

  it('should rethrow unknown errors in searchPaginated', async () => {
    mockDelegate.findMany.mockRejectedValue(new Error('Database is down'));
    await expect(repo.searchPaginated({ page: 0, size: 10 }))
      .rejects.toThrow('Database is down');
  });

  it('should handle non-Error exceptions in searchPaginated', async () => {
    mockDelegate.findMany.mockRejectedValue("string error");
    await expect(repo.searchPaginated({ page: 0, size: 10 }))
      .rejects.toBe("string error");
  });

  it('should find many records with arguments', async () => {
    mockDelegate.findMany.mockResolvedValue([{ id: '1' }]);
    const result = await repo.findMany({ where: { name: 'test' } });
    expect(result).toEqual([{ id: '1' }]);
    expect(mockDelegate.findMany).toHaveBeenCalledWith({ where: { name: 'test' } });
  });

  it('should find many records without arguments (defaulting to empty object)', async () => {
    mockDelegate.findMany.mockResolvedValue([]);
    const result = await repo.findMany();
    expect(result).toEqual([]);
    expect(mockDelegate.findMany).toHaveBeenCalledWith({});
  });
});

