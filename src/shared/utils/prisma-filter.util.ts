export type FilterType = 'string' | 'number' | 'boolean' | 'date' | 'uuid';
export type QueryOperator = 'equals' | 'contains' | 'in' | 'notIn' | 'gt' | 'lt' | 'gte' | 'lte';

export interface AdvancedFilter {
  key: string;
  search: unknown;
  qt?: QueryOperator;
  type?: 'nested' | 'nestedArray';
  dataType?: FilterType;
}

const parseValue = (value: unknown, type?: FilterType) => {
  if (value === undefined || value === null) return value;

  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true' || value === true || value === 1 || value === '1';
    case 'date':
      return new Date(value as string);
    default:
      return value;
  }
};

const parseQT = (qt?: QueryOperator) => {
  return qt ?? 'equals';
};

export function parseFilterData(filters: AdvancedFilter[]): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];

  for (const filter of filters) {
    const qt = parseQT(filter.qt);
    const value = parseValue(filter.search, filter.dataType);

    const ignoreCase = (typeof value === 'string' && qt === 'contains') ? { mode: 'insensitive' } : {};

    const condition = { [qt]: value, ...ignoreCase };

    if (filter.type === 'nested') {
      const keys = filter.key.split('.');
      const nestedCondition = keys.reduceRight((acc, cur, index) => {
        if (index === keys.length - 1) return { [cur]: condition };
        return { [cur]: acc };
      }, {} as Record<string, unknown>);

      result.push(nestedCondition);

    } else if (filter.type === 'nestedArray') {
      const keys = filter.key.split('.');
      const nestedCondition = keys.reduceRight((acc, cur, index) => {
        if (index === keys.length - 1) return { [cur]: condition };
        if (index === 0) return { [cur]: { some: acc } };
        return { [cur]: acc };
      }, {} as Record<string, unknown>);

      result.push(nestedCondition);

    } else {
      result.push({
        [filter.key]: condition
      });
    }
  }

  return result;
}

export function buildWhereClause(filter: Record<string, unknown> = {}): Record<string, unknown> {
  const { filterData, andRules, orRules, ignoreDefaultFilters, ...normalFilters } = filter;
  const finalWhere: Record<string, unknown> = { ...normalFilters };

  const andConditions = Array.isArray(andRules) ? parseFilterData(andRules as AdvancedFilter[]) : [];
  let orArray: unknown[] = [];
  if (Array.isArray(orRules)) {
    orArray = orRules;
  } else if (Array.isArray(filterData)) {
    orArray = filterData;
  }
  const orConditions = parseFilterData(orArray as AdvancedFilter[]);

  if (ignoreDefaultFilters !== true) {
    if (finalWhere.active === undefined && !andConditions.some(c => 'active' in c)) {
      finalWhere.active = true;
    }
  }

  // Soft delete filter is globally enforced by default on ALL endpoints
  // unless explicitly requested (e.g. finalWhere.is_deleted = true)
  if (finalWhere.is_deleted === undefined && !andConditions.some(c => 'is_deleted' in c)) {
    finalWhere.is_deleted = false;
  }

  const andBlocks: Record<string, unknown>[] = [];

  if (Object.keys(finalWhere).length > 0) {
    andBlocks.push(finalWhere);
  }

  if (andConditions.length > 0) {
    andBlocks.push(...andConditions);
  }

  if (orConditions.length > 0) {
    andBlocks.push({ OR: orConditions });
  }

  return { AND: andBlocks };
}
