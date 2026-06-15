import { BaseController } from '@/core/BaseController.js';
import { BaseRepository, PrismaDelegate } from '@/core/BaseRepository.js';
import { BaseService } from '@/core/BaseService.js';
import { FastifyReply, FastifyRequest } from 'fastify';
import { describe, expect, it, vi } from 'vitest';

class MockPrismaDelegate implements PrismaDelegate<any> {
  findUnique = vi.fn();
  findMany = vi.fn().mockResolvedValue([]);
  count = vi.fn().mockResolvedValue(0);
  create = vi.fn();
  update = vi.fn();
}

interface TestModel {
  id: string;
  name: string;
  category_id: string;
  active: boolean;
}

class TestRepository extends BaseRepository<TestModel, any, any, MockPrismaDelegate> {
  constructor(delegate: MockPrismaDelegate) {
    super(delegate, 'TestModel');
  }
}

class TestService extends BaseService<TestModel, any, any, TestRepository> {
  constructor(repository: TestRepository) {
    super(repository);

    this.allowFilters([
      { key: 'name', qt: 'contains' },
      { key: 'categoryId', relation: 'nested', type: 'uuid' },
      { key: 'category.name', relation: 'nested' },
      { key: 'tags.name', relation: 'nestedArray' },
      { key: 'status', qt: 'equals', type: 'boolean' },

      { key: 'startDate', qt: 'gte', targetKey: 'created_at', type: 'date' },
      { key: 'endDate', qt: 'lte', targetKey: 'created_at', type: 'date' }
    ]);

    this.allowSearch([
      { key: 'name' },
      { key: 'description' }
    ]);
  }
}

class TestController extends BaseController<TestModel, any, any, TestService> {
  constructor(service: TestService) {
    super(service);
  }
}

describe('Filter System Integration (Controller -> Service -> Repo -> Prisma)', () => {
  const createSut = () => {
    const delegate = new MockPrismaDelegate();
    const repository = new TestRepository(delegate);
    const service = new TestService(repository);
    const controller = new TestController(service);
    return { controller, service, repository, delegate };
  };

  it('should process a complex query from controller down to Prisma', async () => {
    const { controller, delegate } = createSut();

    const mockRequest = {
      query: {
        'category.name': 'Electronics',
        'status': 'true',
        'page': '1',
        'size': '20'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn().mockReturnThis()
    } as unknown as FastifyReply;

    await controller.listItems(mockRequest, mockReply);

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20,
      take: 20,
      where: {
        AND: [
          { active: true, is_deleted: false },
          { category: { name: { equals: 'Electronics' } } },
          { status: { equals: true } }
        ]
      }
    }));
  });

  it('should handle pagination and sorting', async () => {
    const { controller, delegate } = createSut();

    const mockRequest = {
      query: {
        page: '5',
        size: '10',
        orderBy: 'name',
        orderDirection: 'asc'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await controller.listItems(mockRequest, mockReply);

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 50,
      take: 10,
      orderBy: { name: 'asc' }
    }));
  });

  it('should handle date range with field mapping (startDate/endDate)', async () => {
    const { controller, delegate } = createSut();

    const mockRequest = {
      query: {
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await controller.listItems(mockRequest, mockReply);

    const callArgs = delegate.findMany.mock.calls[0][0];

    expect(callArgs.where.AND).toContainEqual({ created_at: { gte: new Date('2024-01-01') } });
    expect(callArgs.where.AND).toContainEqual({ created_at: { lte: new Date('2024-12-31') } });
  });

  it('should handle global search (OR rules) with mandatory searchFields', async () => {
    const { controller, delegate } = createSut();

    const mockRequest = {
      query: {
        searchWord: 'node',
        searchFields: 'name,description'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await controller.listItems(mockRequest, mockReply);

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [
          { active: true, is_deleted: false },
          {
            OR: [
              { name: { contains: 'node', mode: 'insensitive' } },
              { description: { contains: 'node', mode: 'insensitive' } }
            ]
          }
        ]
      })
    }));
  });

  it('should throw BadRequestError if searchWord is provided without searchFields', async () => {
    const { controller } = createSut();

    const mockRequest = {
      query: {
        searchWord: 'node'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await expect(controller.listItems(mockRequest, mockReply))
      .rejects.toThrow('O parâmetro "searchFields" é obrigatório quando "searchWord" é fornecido.');
  });

  it('should throw BadRequestError if filters are not in the whitelist', async () => {
    const { controller } = createSut();

    const mockRequest = {
      query: {
        maliciousField: 'exploit'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
        send: vi.fn()
    } as unknown as FastifyReply;

    await expect(controller.listItems(mockRequest, mockReply))
      .rejects.toThrow("O filtro 'maliciousField' não é permitido para este recurso.");
  });

  it('should handle nested array filters (some)', async () => {
    const { controller, delegate } = createSut();

    const mockRequest = {
      query: {
        'tags.name': 'typescript'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await controller.listItems(mockRequest, mockReply);

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          { active: true, is_deleted: false },
          {
            tags: {
              some: {
                name: { equals: 'typescript' }
              }
            }
          }
        ]
      }
    }));
  });

  it('should only search in specific fields if searchFields is provided', async () => {
    const { controller, delegate } = createSut();

    const mockRequest = {
      query: {
        searchWord: 'node',
        searchFields: 'name'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await controller.listItems(mockRequest, mockReply);

    expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: [
          { active: true, is_deleted: false },
          {
            OR: [
              { name: { contains: 'node', mode: 'insensitive' } }
            ]
          }
        ]
      })
    }));
  });

  it('should throw BadRequestError if requested search field is not in whitelist', async () => {
    const { controller } = createSut();

    const mockRequest = {
      query: {
        searchWord: 'node',
        searchFields: 'name,secret_internal_field'
      }
    } as unknown as FastifyRequest<{ Querystring: any }>;

    const mockReply = {
      send: vi.fn()
    } as unknown as FastifyReply;

    await expect(controller.listItems(mockRequest, mockReply))
      .rejects.toThrow("O campo 'secret_internal_field' não está disponível para pesquisa global.");
  });

  it('should handle buildWhereClause with default argument', async () => {
    const { buildWhereClause } = await import('@/shared/utils/prisma-filter.util.js');
    const result = buildWhereClause();
    expect(result).toEqual({ AND: [{ active: true, is_deleted: false }] });
  });
});
