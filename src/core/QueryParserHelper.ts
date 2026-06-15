import { BadRequestError } from '../shared/errors/AppError.js';
import { AdvancedFilter, QueryOperator } from '../shared/utils/prisma-filter.util.js';
import { FilterConfig, SearchConfig } from './BaseService.js';

function buildFilterRule(
  key: string,
  val: unknown,
  query: Record<string, unknown>,
  filterableFields: Map<string, FilterConfig>
): AdvancedFilter[] {
  const { fieldKey, operator, isSpecificRange } = normalizeFieldKey(key);

  if (!filterableFields.has(fieldKey)) {
    throw new BadRequestError(`O filtro '${fieldKey}' não é permitido para este recurso.`);
  }

  const config = filterableFields.get(fieldKey)!;

  if (config.type === 'date' && typeof val === 'string') {
    const dateRules = parseDateFilter(val, operator, isSpecificRange, config, query, fieldKey);
    if (dateRules.length > 0) {
      return dateRules;
    }
  }

  return [{
    key: config.targetKey ?? config.key,
    search: val,
    qt: config.qt ?? (operator !== 'equals' ? operator : 'equals'),
    type: config.relation,
    dataType: config.type
  }];
}

export function parseQueryParams(
  query: Record<string, unknown>,
  filterableFields: Map<string, FilterConfig>,
  searchableFields: SearchConfig[]
): { andRules: AdvancedFilter[], orRules: AdvancedFilter[] } {
  const reservedKeys = ['page', 'size', 'searchWord', 'searchFields', 'orderBy', 'orderDirection'];

  const orRules = parseSearchRules(query, searchableFields);
  const andRules: AdvancedFilter[] = [];

  for (const [key, val] of Object.entries(query)) {
    if (val === undefined || val === null || val === '') continue;
    if (reservedKeys.includes(key)) continue;

    andRules.push(...buildFilterRule(key, val, query, filterableFields));
  }

  return { andRules, orRules };
}

function parseSearchRules(
  query: Record<string, unknown>,
  searchableFields: SearchConfig[]
): AdvancedFilter[] {
  const { searchWord, searchFields } = query;

  if (!searchWord || typeof searchWord !== 'string') return [];

  if (searchableFields.length === 0) {
    throw new BadRequestError('A pesquisa global (searchWord) não está habilitada para este recurso.');
  }

  if (!searchFields || typeof searchFields !== 'string' || searchFields.trim() === '') {
    throw new BadRequestError('O parâmetro "searchFields" é obrigatório quando "searchWord" é fornecido.');
  }

  return searchFields.split(',').map(fieldKey => {
    const field = fieldKey.trim();
    const config = searchableFields.find(f => f.key === field);

    if (!config) {
      throw new BadRequestError(`O campo '${field}' não está disponível para pesquisa global.`);
    }

    return {
      key: config.key,
      search: searchWord,
      qt: 'contains',
      type: config.relation
    };
  });
}

function normalizeFieldKey(key: string): { fieldKey: string; operator: QueryOperator; isSpecificRange: boolean } {
  if (key.endsWith('_start')) {
    return { fieldKey: key.replace('_start', ''), operator: 'gte', isSpecificRange: true };
  }
  if (key.endsWith('_end')) {
    return { fieldKey: key.replace('_end', ''), operator: 'lte', isSpecificRange: true };
  }
  return { fieldKey: key, operator: 'equals', isSpecificRange: false };
}

export function parseDateFilter(
  val: string,
  operator: QueryOperator,
  isSpecificRange: boolean,
  config: FilterConfig,
  query: Record<string, unknown>,
  fieldKey: string
): AdvancedFilter[] {
  const rules: AdvancedFilter[] = [];
  const [year, month, day] = val.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  if (isNaN(date.getTime())) {
    return rules;
  }

  const targetKey = config.targetKey ?? config.key;

  if (isSpecificRange) {
    const adjustedDate = new Date(date);
    
    if (operator === 'gte') {
      adjustedDate.setHours(0, 0, 0, 0);
      rules.push({ key: targetKey, search: adjustedDate.toISOString(), qt: 'gte', type: config.relation, dataType: 'date' });

      const hasEnd = !!query[`${fieldKey}_end`];
      if (!hasEnd) {
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        rules.push({ key: targetKey, search: endOfDay.toISOString(), qt: 'lte', type: config.relation, dataType: 'date' });
      }
    } else {
      adjustedDate.setHours(23, 59, 59, 999);
      rules.push({ key: targetKey, search: adjustedDate.toISOString(), qt: 'lte', type: config.relation, dataType: 'date' });
    }
  } else if (!config.qt || config.qt === 'equals') {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    rules.push({ key: targetKey, search: startOfDay.toISOString(), qt: 'gte', type: config.relation, dataType: 'date' });
    rules.push({ key: targetKey, search: endOfDay.toISOString(), qt: 'lte', type: config.relation, dataType: 'date' });
  }

  return rules;
}


export function validateOrder(
  orderBy: unknown,
  filterableFields: Map<string, FilterConfig>
): void {
  if (orderBy && typeof orderBy === 'string') {
    const isAllowed = filterableFields.has(orderBy) || orderBy === 'created_at' || orderBy === 'updated_at';
    if (!isAllowed) {
      throw new BadRequestError(`A ordenação pelo campo '${orderBy}' não é permitida.`);
    }
  }
}
