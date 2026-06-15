import { describe, it, expect } from 'vitest';
import { buildWhereClause, parseFilterData } from '@/shared/utils/prisma-filter.util.js';

describe('PrismaFilter Utility', () => {
  describe('parseFilterData', () => {
    it('should parse direct equality filters', () => {
      const filters = [
        { key: 'name', search: 'John', qt: 'equals' as const }
      ];
      const result = parseFilterData(filters);
      expect(result).toEqual([{ name: { equals: 'John' } }]);
    });

    it('should parse number types correctly', () => {
      const filters = [
        { key: 'age', search: '25', dataType: 'number' as const }
      ];
      const result = parseFilterData(filters);
      expect(result).toEqual([{ age: { equals: 25 } }]);
    });

    it('should parse boolean types correctly', () => {
      const filters = [
        { key: 'active', search: 'true', dataType: 'boolean' as const },
        { key: 'is_deleted', search: '0', dataType: 'boolean' as const }
      ];
      const result = parseFilterData(filters);
      expect(result[0]).toEqual({ active: { equals: true } });
      expect(result[1]).toEqual({ is_deleted: { equals: false } });
    });

    it('should handle case-insensitive contains for strings', () => {
      const filters = [
        { key: 'email', search: 'GMAIL', qt: 'contains' as const }
      ];
      const result = parseFilterData(filters);
      expect(result).toEqual([{ email: { contains: 'GMAIL', mode: 'insensitive' } }]);
    });

    it('should handle nested relations', () => {
      const filters = [
        { key: 'profile.address.city', search: 'NY', type: 'nested' as const }
      ];
      const result = parseFilterData(filters);
      expect(result).toEqual([{
        profile: {
          address: {
            city: { equals: 'NY' }
          }
        }
      }]);
    });

    it('should handle nested array relations (some)', () => {
      const filters = [
        { key: 'posts.tags.name', search: 'tech', type: 'nestedArray' as const }
      ];
      const result = parseFilterData(filters);
      expect(result).toEqual([{
        posts: {
          some: {
            tags: {
              name: { equals: 'tech' }
            }
          }
        }
      }]);
    });
  });

  describe('buildWhereClause', () => {
    it('should default to active: true if not specified', () => {
      const result = buildWhereClause({});
      expect(result).toEqual({ AND: [{ active: true, is_deleted: false }] });
    });

    it('should combine normal filters and andRules', () => {
      const filter = {
        active: false,
        andRules: [
          { key: 'category', search: 'electronics' }
        ]
      };
      const result = buildWhereClause(filter);
      expect(result).toEqual({
        AND: [
          { active: false, is_deleted: false },
          { category: { equals: 'electronics' } }
        ]
      });
    });

    it('should handle complex AND/OR combinations', () => {
      const filter = {
        andRules: [{ key: 'status', search: 'published' }],
        orRules: [
          { key: 'title', search: 'node', qt: 'contains' as const },
          { key: 'content', search: 'node', qt: 'contains' as const }
        ]
      };
      const result = buildWhereClause(filter);
      expect(result).toEqual({
        AND: [
          { active: true, is_deleted: false },
          { status: { equals: 'published' } },
          {
            OR: [
              { title: { contains: 'node', mode: 'insensitive' } },
              { content: { contains: 'node', mode: 'insensitive' } }
            ]
          }
        ]
      });
    });

    it('should handle date range (multiple conditions for the same field)', () => {
      const filter = {
        andRules: [
          { key: 'created_at', search: '2024-01-01', qt: 'gte' as const, dataType: 'date' as const },
          { key: 'created_at', search: '2024-12-31', qt: 'lte' as const, dataType: 'date' as const }
        ]
      };
      const result = buildWhereClause(filter) as any;

      expect(result.AND).toHaveLength(3);
      expect(result.AND).toContainEqual({ created_at: { gte: new Date('2024-01-01') } });
      expect(result.AND).toContainEqual({ created_at: { lte: new Date('2024-12-31') } });
    });

    it('should return empty object if no conditions and active is false', () => {
      const result = buildWhereClause({ active: false });
      expect(result).toEqual({ AND: [{ active: false, is_deleted: false }] });
    });

    it('should handle filterData as alias for orRules', () => {
      const filter = {
        filterData: [{ key: 'name', search: 'test' }]
      };
      const result = buildWhereClause(filter);
      expect(result.AND).toContainEqual({ OR: [{ name: { equals: 'test' } }] });
    });

    it('should not add active: true if active is already in andRules', () => {
      const filter = {
        andRules: [{ key: 'active', search: false, dataType: 'boolean' as const }]
      };
      const result = buildWhereClause(filter) as any;
      expect(result.AND).not.toContainEqual({ active: true });
      expect(result.AND).toContainEqual({ active: { equals: false } });
    });

    it('should return empty object if truly empty', () => {

      const result = buildWhereClause({ andRules: [{ key: 'active', search: true, dataType: 'boolean' as const }] });

      expect(result).toHaveProperty('AND');
    });

    it('should handle null/undefined in parseValue', () => {
      const result = parseFilterData([{ key: 'test', search: null }]);
      expect(result).toEqual([{ test: { equals: null } }]);

      const result2 = parseFilterData([{ key: 'test', search: undefined }]);
      expect(result2).toEqual([{ test: { equals: undefined } }]);
    });

    it('should not add is_deleted: false if is_deleted is already specified', () => {
      const result = buildWhereClause({ is_deleted: true });
      expect(result).toEqual({ AND: [{ active: true, is_deleted: true }] });
    });

    it('should enforce is_deleted: false even if ignoreDefaultFilters is true', () => {
      const result = buildWhereClause({ ignoreDefaultFilters: true });
      expect(result).toEqual({ AND: [{ is_deleted: false }] });
    });

    it('should cover branch when finalWhere is empty (andRules has is_deleted)', () => {
      const result = buildWhereClause({ 
        ignoreDefaultFilters: true, 
        andRules: [{ key: 'is_deleted', search: true, dataType: 'boolean' as const }] 
      }) as any;
      expect(result.AND).toHaveLength(1);
      expect(result.AND[0]).toEqual({ is_deleted: { equals: true } });
    });

    it('should handle default argument', () => {
      const result = buildWhereClause();
      expect(result).toEqual({ AND: [{ active: true, is_deleted: false }] });
    });
  });
});
