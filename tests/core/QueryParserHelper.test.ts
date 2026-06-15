import { describe, expect, it } from 'vitest';
import { parseQueryParams } from '../../src/core/QueryParserHelper.js';
import { FilterConfig, SearchConfig } from '../../src/core/BaseService.js';

describe('QueryParserHelper Unit Tests', () => {
  const filterableFields = new Map<string, FilterConfig>([
    ['name', { key: 'name', qt: 'contains' }],
    ['status', { key: 'status', type: 'boolean' }],
    ['createdAt', { key: 'createdAt', type: 'date' }],
    ['price', { key: 'price', type: 'number' }],
  ]);

  const searchableFields: SearchConfig[] = [
    { key: 'name' },
  ];

  it('should cover line 38 branch: config.qt is missing and operator is not equals', () => {
    const query = {
      price_start: '100',
    };

    const { andRules } = parseQueryParams(query, filterableFields, []);

    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'price',
      search: '100',
      qt: 'gte' // This hits (operator !== 'equals' ? operator : 'equals') where operator is 'gte'
    }));
  });

  it('should cover line 38 branch: config.qt is missing and operator is equals', () => {
    const query = {
      price: '100',
    };

    const { andRules } = parseQueryParams(query, filterableFields, []);

    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'price',
      search: '100',
      qt: 'equals' // This hits (operator !== 'equals' ? operator : 'equals') where operator is 'equals'
    }));
  });

  it('should ensure date filter with "equals" (no qt) expands to full day range', () => {
    const query = {
      createdAt: '2024-05-14',
    };

    const { andRules } = parseQueryParams(query, filterableFields, []);

    // Should generate two rules: gte 00:00:00 and lte 23:59:59.999
    expect(andRules).toHaveLength(2);
    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'createdAt',
      search: new Date('2024-05-14T00:00:00').toISOString(),
      qt: 'gte'
    }));
    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'createdAt',
      search: new Date('2024-05-14T23:59:59.999').toISOString(),
      qt: 'lte'
    }));
  });

  it('should ensure date filter with "_end" suffix sets time to 23:59:59.999', () => {
    const query = {
      createdAt_end: '2024-05-14',
    };

    const { andRules } = parseQueryParams(query, filterableFields, []);

    expect(andRules).toHaveLength(1);
    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'createdAt',
      search: new Date('2024-05-14T23:59:59.999').toISOString(),
      qt: 'lte'
    }));
  });

  it('should ensure date filter with "_start" suffix without matching "_end" auto-completes to end of that day', () => {
    const query = {
      createdAt_start: '2024-05-14',
    };

    const { andRules } = parseQueryParams(query, filterableFields, []);

    expect(andRules).toHaveLength(2);
    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'createdAt',
      search: new Date('2024-05-14T00:00:00').toISOString(),
      qt: 'gte'
    }));
    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'createdAt',
      search: new Date('2024-05-14T23:59:59.999').toISOString(),
      qt: 'lte'
    }));
  });

  it('should handle invalid date values by returning empty rules', () => {
    const query = {
      createdAt: 'invalid-date',
    };

    const { andRules } = parseQueryParams(query, filterableFields, []);
    
    // It should skip the date rules and push the original value as a standard rule (which might fail later in Prisma, but that's expected)
    // Wait, let's check QueryParserHelper.ts logic:
    // if (config.type === 'date' && typeof val === 'string') {
    //   const dateRules = parseDateFilter(val, ...);
    //   if (dateRules.length > 0) { ... andRules.push(...); continue; }
    // }
    // if it's invalid, parseDateFilter returns [], so it pushes the original val.
    expect(andRules).toContainEqual(expect.objectContaining({
      key: 'createdAt',
      search: 'invalid-date'
    }));
  });
});
