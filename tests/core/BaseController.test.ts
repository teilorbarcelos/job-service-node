import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseController } from '@/core/BaseController.js';
import { BaseService } from '@/core/BaseService.js';
import { BaseRepository } from '@/core/BaseRepository.js';

class MockRepository extends BaseRepository<any, any, any, any> {
  constructor() {
    super({} as any, 'Mock');
  }
}

class MockService extends BaseService<any, any, any, MockRepository> {
  constructor() {
    super(new MockRepository());
  }
}

class MockController extends BaseController<any, any, any, MockService> {
  constructor() {
    super(new MockService());
  }
}

describe('BaseController', () => {
  let controller: MockController;
  let service: MockService;

  beforeEach(() => {
    service = new MockService();
    controller = new MockController();

    (controller as any).service = service;
  });

  it('should call service.listAllItems in listAllItems', async () => {
    const listSpy = vi.spyOn(service, 'listAllItems').mockResolvedValue({
      items: [],
      total: 0,
      page: 0,
      size: 10
    });

    const mockRequest = {
      query: { page: 0, size: 10 }
    } as any;

    const mockReply = {
      send: vi.fn()
    } as any;

    await controller.listAllItems(mockRequest, mockReply);

    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, size: 10 })
    );
    expect(mockReply.send).toHaveBeenCalled();
  });

  it('should return 404 if getById record not found', async () => {
    vi.spyOn(service, 'retrieveById').mockResolvedValue(null);

    const mockRequest = { params: { id: '1' } } as any;
    const mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn()
    } as any;

    await controller.getById(mockRequest, mockReply);

    expect(mockReply.status).toHaveBeenCalledWith(404);
  });
});
