import { BaseService } from '@/core/BaseService.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('BaseService', () => {
  const mockRepo = {
    searchPaginated: vi.fn(),
    countRecords: vi.fn(),
    persistRecord: vi.fn(),
    updateRecordDetails: vi.fn(),
    softDeleteRecord: vi.fn(),
    activateRecord: vi.fn(),
    deactivateRecord: vi.fn(),
    findOneById: vi.fn(),
  };

  class TestService extends BaseService<any, any, any, any> {
    constructor() {
      super(mockRepo as any);
      this.allowFilters([
        { key: 'name' },
        { key: 'createdAt', type: 'date' }
      ]);
      this.allowSearch([{ key: 'name' }]);
    }
  }

  const service = new TestService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle smart date range expansion for date type filters', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.listItems({ createdAt: '2024-01-01' });

    expect(mockRepo.searchPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        andRules: expect.arrayContaining([
          expect.objectContaining({ key: 'createdAt', qt: 'gte' }),
          expect.objectContaining({ key: 'createdAt', qt: 'lte' })
        ])
      }),
      undefined,
      expect.any(Object)
    );
  });

  it('should fallback to default filter if date is invalid', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.listItems({ createdAt: 'invalid-date' });

    expect(mockRepo.searchPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        andRules: expect.arrayContaining([
          expect.objectContaining({ key: 'createdAt', search: 'invalid-date', qt: 'equals' })
        ])
      }),
      undefined,
      expect.any(Object)
    );
  });

  it('should handle manual date range with _start and _end suffixes', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.listItems({ 
      createdAt_start: '2024-01-01',
      createdAt_end: '2024-01-10'
    });

    expect(mockRepo.searchPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        andRules: expect.arrayContaining([
          expect.objectContaining({ key: 'createdAt', qt: 'gte' }),
          expect.objectContaining({ key: 'createdAt', qt: 'lte' })
        ])
      }),
      undefined,
      expect.any(Object)
    );
  });

  it('should expand to single day when only start date is provided', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.listItems({ createdAt_start: '2024-01-01' });

    expect(mockRepo.searchPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        andRules: expect.arrayContaining([
          expect.objectContaining({ key: 'createdAt', qt: 'gte', search: new Date('2024-01-01T00:00:00').toISOString() }),
          expect.objectContaining({ key: 'createdAt', qt: 'lte', search: new Date('2024-01-01T23:59:59.999').toISOString() })
        ])
      }),
      undefined,
      expect.any(Object)
    );
  });

  it('should call repository searchPaginated in search method', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.search({ page: 0, size: 10 });
    expect(mockRepo.searchPaginated).toHaveBeenCalled();
  });

  it('should call repository countRecords in count method', async () => {
    mockRepo.countRecords.mockResolvedValue(10);
    await service.count();
    expect(mockRepo.countRecords).toHaveBeenCalled();
  });

  it('should call repository persistRecord in create method', async () => {
    mockRepo.persistRecord.mockResolvedValue({});
    await service.create({});
    expect(mockRepo.persistRecord).toHaveBeenCalled();
  });

  it('should call repository updateRecordDetails in update method', async () => {
    mockRepo.updateRecordDetails.mockResolvedValue({});
    await service.update('1', {});
    expect(mockRepo.updateRecordDetails).toHaveBeenCalled();
  });

  it('should call repository softDeleteRecord in delete method', async () => {
    mockRepo.softDeleteRecord.mockResolvedValue({});
    await service.delete('1');
    expect(mockRepo.softDeleteRecord).toHaveBeenCalled();
  });

  it('should call activateRecord when setStatus is true', async () => {
    mockRepo.activateRecord.mockResolvedValue({});
    await service.setStatus('1', true);
    expect(mockRepo.activateRecord).toHaveBeenCalled();
  });

  it('should call deactivateRecord when setStatus is false', async () => {
    mockRepo.deactivateRecord.mockResolvedValue({});
    await service.setStatus('1', false);
    expect(mockRepo.deactivateRecord).toHaveBeenCalled();
  });

  it('should throw BadRequestError if filters are not in the whitelist', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await expect(service.listItems({ unknown: 'val' })).rejects.toThrow();
  });

  it('should handle searchWord in listItems method', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.listItems({ searchWord: 'test', searchFields: 'name' });
    expect(mockRepo.searchPaginated).toHaveBeenCalled();
  });

  it('should throw BadRequestError when searchWord is used but search is disabled', async () => {
    class NoSearchService extends BaseService<any, any, any, any> {
      constructor() {
        super(mockRepo as any);
      }
    }
    const noSearchService = new NoSearchService();
    await expect(noSearchService.listItems({ searchWord: 'test', searchFields: 'name' }))
      .rejects.toThrow('A pesquisa global (searchWord) não está habilitada para este recurso.');
  });

  it('should throw BadRequestError when orderBy is not allowed', async () => {
    await expect(service.listItems({ orderBy: 'secret_field' }))
      .rejects.toThrow("A ordenação pelo campo 'secret_field' não é permitida.");
  });

  it('should throw BadRequestError when size exceeds 100', async () => {
    await expect(service.listItems({ size: 101 }))
      .rejects.toThrow('O tamanho máximo da página é 100 itens.');
  });

  it('should skip null, undefined or empty filters', async () => {
    mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0 });
    await service.listItems({ name: '', createdAt: null, other: undefined });
    
    expect(mockRepo.searchPaginated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        andRules: []
      }),
      undefined,
      expect.any(Object)
    );
  });

  describe('listAllItems', () => {
    it('should call repository.searchPaginated with ignoreDefaultFilters: true', async () => {
      mockRepo.searchPaginated.mockResolvedValue({ items: [], total: 0, page: 0, size: 10 });

      await service.listAllItems({ page: 0, size: 10, name: 'Test' });

      expect(mockRepo.searchPaginated).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          andRules: [
            expect.objectContaining({ key: 'name', search: 'Test' })
          ],
          ignoreDefaultFilters: true
        }),
        undefined,
        expect.anything()
      );
    });
  });
});
