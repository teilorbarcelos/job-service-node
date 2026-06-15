import { BadRequestError } from '../shared/errors/AppError.js';
import { buildWhereClause } from '../shared/utils/prisma-filter.util.js';

export interface PaginationParams {
  page: number;
  size: number;
}

export interface OrderParams {
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface PrismaDelegate<T> {
  findUnique(args: unknown): Promise<T | null>;
  findFirst?(args: unknown): Promise<T | null>;
  findMany(args: unknown): Promise<T[]>;
  count(args: unknown): Promise<number>;
  create(args: unknown): Promise<T>;
  createMany?(args: unknown): Promise<{ count: number }>;
  update(args: unknown): Promise<T>;
  delete?(args: unknown): Promise<T>;
}

export abstract class BaseRepository<
  T extends { id: string },
  CreateDTO,
  UpdateDTO,
  Delegate extends PrismaDelegate<T>
> {
  constructor(
    protected delegate: Delegate,
    protected modelName: string
  ) {}

  async findOneById(id: string, include?: Record<string, unknown>): Promise<T | null> {
    return this.delegate.findUnique({
      where: { id },
      ...(include ? { include } : {}),
    } as unknown);
  }

  async findOneByQuery(query: Record<string, unknown>, include?: Record<string, unknown>): Promise<T | null> {
    if (!this.delegate.findFirst) {
      throw new Error(`findFirst not available on ${this.modelName}`);
    }
    return this.delegate.findFirst({
      where: query,
      ...(include ? { include } : {}),
    } as unknown);
  }

  async findMany(args?: unknown): Promise<T[]> {
    return this.delegate.findMany(args || {});
  }

  async searchPaginated(
    params: PaginationParams,
    filter: Record<string, unknown> = {},
    include?: Record<string, unknown>,
    order?: OrderParams
  ): Promise<SearchResult<T>> {
    const { page, size } = params;
    const skip = page * size;

    const where = buildWhereClause(filter);
    const orderBy = order?.orderBy
      ? { [order.orderBy]: order.orderDirection ?? 'asc' }
      : { created_at: 'desc' as const };

    try {
      const [items, total] = await Promise.all([
        this.delegate.findMany({
          where,
          ...(include ? { include } : {}),
          skip,
          take: size,
          orderBy,
        } as unknown),
        this.delegate.count({ where } as unknown),
      ]);

      return { items, total, page, size };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '';
      
      if (errorMessage.includes('Unknown field') || errorMessage.includes('Invalid `this.delegate')) {
        throw new BadRequestError(
          `Falha na busca/ordenação: o campo '${order?.orderBy}' ou um filtro fornecido não é válido para o modelo ${this.modelName}`
        );
      }
      throw error;
    }
  }

  async persistRecord(data: CreateDTO): Promise<T> {
    return this.delegate.create({ data } as unknown);
  }

  async persistMany(data: CreateDTO[]): Promise<{ count: number }> {
    if (!this.delegate.createMany) {
      throw new Error(`createMany not available on ${this.modelName}`);
    }
    return this.delegate.createMany({ data } as unknown);
  }

  async updateRecordDetails(id: string, data: UpdateDTO): Promise<T> {
    return this.delegate.update({ where: { id }, data } as unknown);
  }

  async deactivateRecord(id: string): Promise<T> {
    return this.delegate.update({
      where: { id },
      data: { active: false },
    } as unknown);
  }

  async activateRecord(id: string): Promise<T> {
    return this.delegate.update({
      where: { id },
      data: { active: true },
    } as unknown);
  }

  async softDeleteRecord(id: string): Promise<T> {
    return this.delegate.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date(), active: false },
    } as unknown);
  }

  async countRecords(filter: Record<string, unknown> = {}): Promise<number> {
    return this.delegate.count({ where: buildWhereClause(filter) } as unknown);
  }

  async existsById(ids: string[]): Promise<{ exists: string[]; missing: string[] }> {
    const records = await this.delegate.findMany({
      where: { id: { in: ids } },
    } as unknown) as (T & { id: string })[];

    const foundIds = records.map(r => r.id);
    return {
      exists: ids.filter(id => foundIds.includes(id)),
      missing: ids.filter(id => !foundIds.includes(id)),
    };
  }
}
