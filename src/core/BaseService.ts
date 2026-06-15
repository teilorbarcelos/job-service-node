import { BadRequestError } from '../shared/errors/AppError.js';
import { FilterType, QueryOperator } from '../shared/utils/prisma-filter.util.js';
import { BaseRepository, OrderParams, PaginationParams, PrismaDelegate, SearchResult } from './BaseRepository.js';
import { parseQueryParams, validateOrder } from './QueryParserHelper.js';

export interface FilterConfig {
  key: string;
  type?: FilterType;
  qt?: QueryOperator;
  relation?: 'nested' | 'nestedArray';
  targetKey?: string;
}

export interface SearchConfig {
  key: string;
  relation?: 'nested' | 'nestedArray';
}

export abstract class BaseService<
  T extends { id: string },
  CreateDTO,
  UpdateDTO,
  R extends BaseRepository<T, CreateDTO, UpdateDTO, PrismaDelegate<T>>
> {
  protected filterableFields: Map<string, FilterConfig> = new Map();
  protected searchableFields: SearchConfig[] = [];

  constructor(protected repository: R) {}

  protected allowFilters(configs: FilterConfig[]) {
    configs.forEach(c => this.filterableFields.set(c.key, c));
  }

  protected allowSearch(configs: SearchConfig[]) {
    this.searchableFields = configs;
  }

  async listItems(
    query: Record<string, unknown>,
    include?: Record<string, unknown>,
    options?: { ignoreDefaultFilters?: boolean }
  ): Promise<SearchResult<T>> {
    const { page = 0, size = 25, orderBy, orderDirection } = query;
    const parsedSize = Number(size);
    if (parsedSize > 100) {
      throw new BadRequestError('O tamanho máximo da página é 100 itens.');
    }

    const { andRules, orRules } = parseQueryParams(query, this.filterableFields, this.searchableFields);

    validateOrder(orderBy, this.filterableFields);

    const order: OrderParams = {
      orderBy: orderBy as string,
      orderDirection: orderDirection as 'asc' | 'desc'
    };

    return this.search(
      { page: Number(page), size: parsedSize },
      { andRules, orRules, ignoreDefaultFilters: options?.ignoreDefaultFilters },
      include,
      order
    );
  }

  async listAllItems(
    query: PaginationParams & Record<string, unknown>,
    include?: Record<string, unknown>
  ): Promise<SearchResult<T>> {

    return this.listItems(query, include, { ignoreDefaultFilters: true });
  }

  async retrieveById(id: string, include?: Record<string, unknown>): Promise<T | null> {
    return this.repository.findOneById(id, include);
  }

  async search(
    params: PaginationParams,
    filter?: Record<string, unknown>,
    include?: Record<string, unknown>,
    order?: OrderParams
  ): Promise<SearchResult<T>> {
    return this.repository.searchPaginated(params, filter, include, order);
  }

  async create(data: CreateDTO): Promise<T> {
    return this.repository.persistRecord(data);
  }

  async update(id: string, data: UpdateDTO): Promise<T> {
    return this.repository.updateRecordDetails(id, data);
  }

  async delete(id: string): Promise<T> {
    return this.repository.softDeleteRecord(id);
  }

  async setStatus(id: string, active: boolean): Promise<T> {
    return active
      ? this.repository.activateRecord(id)
      : this.repository.deactivateRecord(id);
  }

  async count(filter?: Record<string, unknown>): Promise<number> {
    return this.repository.countRecords(filter);
  }
}
