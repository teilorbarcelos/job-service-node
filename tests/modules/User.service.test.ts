import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRepository } from '../../src/modules/User/User.repository.js';
import { UserService } from '../../src/modules/User/User.service.js';
import { CONFIG } from '../../src/shared/config/env.js';
import { BadRequestError } from '../../src/shared/errors/AppError.js';
import { pdfProvider } from '../../src/infra/pdf/PdfProvider.js';
import { logger } from '../../src/shared/utils/logger.js';

vi.mock('../../src/modules/User/User.repository.js');
vi.mock('../../src/infra/email/EmailProvider.js', () => ({
  emailProvider: {
    sendEmail: vi.fn().mockResolvedValue({}),
  }
}));
vi.mock('../../src/infra/bcrypt/BcryptPool.js', () => ({
  bcryptPool: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock('../../src/infra/pdf/PdfProvider.js', () => ({
  pdfProvider: {
    generatePdf: vi.fn().mockResolvedValue('pdf_stream_mock'),
  }
}));

describe('UserService (Unit)', () => {
  let service: UserService;
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = new UserRepository();
    service = new UserService(mockRepo);
  });

  describe('create', () => {
    it('should create a user with id_role', async () => {
      const input = { name: 'Test', email: 'test@test.com', password: 'password123', id_role: 'admin' };
      mockRepo.persistRecord.mockResolvedValue({ id: '1', ...input });

      await service.create(input as any);

      expect(mockRepo.persistRecord).toHaveBeenCalledWith(expect.objectContaining({
        Role: { connect: { id: 'admin' } },
      }));
    });

    it('should create a user without id_role (branch coverage)', async () => {
      const input = { name: 'Test', email: 'test@test.com', password: 'password123' };
      mockRepo.persistRecord.mockResolvedValue({ id: '1', ...input });

      await service.create(input as any);

      expect(mockRepo.persistRecord).toHaveBeenCalledWith(expect.objectContaining({
        Auth: expect.anything(),
      }));
      
      const createData = mockRepo.persistRecord.mock.calls[0][0];
      expect(createData.Role).toBeUndefined();
    });

    it('should log error if email fails (line 75)', async () => {
      const input = { name: 'Test', email: 'test@test.com', password: 'password123' };
      mockRepo.persistRecord.mockResolvedValue({ id: '1', ...input });
      const loggerSpy = vi.spyOn(logger, 'error');
      
      const { emailProvider } = await import('../../src/infra/email/EmailProvider.js');
      vi.mocked(emailProvider.sendEmail).mockRejectedValueOnce(new Error('SMTP Fail'));

      await service.create(input as any);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ err: 'SMTP Fail' }), 'Erro ao enviar e-mail de boas-vindas');
      loggerSpy.mockRestore();
    });

    it('should log error if email fails with non-Error object (branch coverage line 75)', async () => {
      const input = { name: 'Test', email: 'test@test.com', password: 'password123' };
      mockRepo.persistRecord.mockResolvedValue({ id: '1', ...input });
      const loggerSpy = vi.spyOn(logger, 'error');
      
      const { emailProvider } = await import('../../src/infra/email/EmailProvider.js');
      vi.mocked(emailProvider.sendEmail).mockRejectedValueOnce('SMTP Fatal Error String');

      await service.create(input as any);

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(loggerSpy).toHaveBeenCalledWith({ err: 'SMTP Fatal Error String' }, 'Erro ao enviar e-mail de boas-vindas');
      loggerSpy.mockRestore();
    });
  });

  describe('update', () => {
    it('should update first user with password (line 85-89)', async () => {
      const id = '1';
      const input = { password: 'new-password' };
      mockRepo.findOneById.mockResolvedValue({ id, email: CONFIG.FIRST_USER });
      mockRepo.updateRecordDetails.mockResolvedValue({ id, email: CONFIG.FIRST_USER });

      await service.update(id, input as any);

      expect(mockRepo.updateRecordDetails).toHaveBeenCalledWith(id, expect.objectContaining({
        Auth: { update: { password: 'hashed_password' } }
      }));
    });

    it('should update first user without password (line 91)', async () => {
      const id = '1';
      const input = { name: 'New Name' };
      mockRepo.findOneById.mockResolvedValue({ id, email: CONFIG.FIRST_USER });
      mockRepo.updateRecordDetails.mockResolvedValue({ id, email: CONFIG.FIRST_USER });

      await service.update(id, input as any);

      expect(mockRepo.updateRecordDetails).toHaveBeenCalledWith(id, {});
    });

    it('should update regular user with id_role and password (line 98, 102-103)', async () => {
      const id = '2';
      const input = { name: 'Updated', id_role: 'manager', password: 'pass' };
      mockRepo.findOneById.mockResolvedValue({ id, email: 'other@test.com' });
      mockRepo.updateRecordDetails.mockResolvedValue({ id, ...input });

      await service.update(id, input as any);

      expect(mockRepo.updateRecordDetails).toHaveBeenCalledWith(id, expect.objectContaining({
        Role: { connect: { id: 'manager' } },
        Auth: { update: { password: 'hashed_password' } }
      }));
    });

    it('should update a user without id_role (branch coverage)', async () => {
      const id = '1';
      const input = { name: 'Updated' };
      mockRepo.findOneById.mockResolvedValue({ id, email: 'other@test.com' });
      mockRepo.updateRecordDetails.mockResolvedValue({ id, ...input });

      await service.update(id, input as any);

      expect(mockRepo.updateRecordDetails).toHaveBeenCalledWith(id, expect.not.objectContaining({
        Role: expect.anything(),
      }));
    });
  });

  describe('delete', () => {
    it('should throw error when deleting first user (line 111-113)', async () => {
      mockRepo.findOneById.mockResolvedValue({ id: '1', email: CONFIG.FIRST_USER });
      await expect(service.delete('1')).rejects.toThrow(BadRequestError);
    });

    it('should allow deleting other users', async () => {
      mockRepo.findOneById.mockResolvedValue({ id: '2', email: 'other@t.com' });
      mockRepo.softDeleteRecord.mockResolvedValue({ id: '2', is_deleted: true });
      await service.delete('2');
      expect(mockRepo.softDeleteRecord).toHaveBeenCalledWith('2');
    });
  });

  describe('setStatus', () => {
    it('should throw error when deactivating first user (line 119-121)', async () => {
      mockRepo.findOneById.mockResolvedValue({ id: '1', email: CONFIG.FIRST_USER });
      await expect(service.setStatus('1', false)).rejects.toThrow(BadRequestError);
    });

    it('should allow deactivating other users', async () => {
      mockRepo.findOneById.mockResolvedValue({ id: '2', email: 'other@t.com' });
      mockRepo.deactivateRecord.mockResolvedValue({ id: '2', active: false });
      await service.setStatus('2', false);
      expect(mockRepo.deactivateRecord).toHaveBeenCalledWith('2');
    });
  });

  describe('exportPdf', () => {
    it('should export users as PDF successfully', async () => {
      const query = { orderBy: 'name', orderDirection: 'asc' };
      const mockUsers = [
        { id: '1', name: 'User A', email: 'a@t.com', phone: '123', active: true, Role: { name: 'Admin' } },
        { id: '2', name: 'User B', email: 'b@t.com', phone: '456', active: false, Role: null },
      ];
      mockRepo.findMany = vi.fn().mockResolvedValue(mockUsers);

      const result = await service.exportPdf(query);

      expect(mockRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { name: 'asc' },
        include: { Role: true },
      }));
      expect(pdfProvider.generatePdf).toHaveBeenCalledWith(expect.objectContaining({
        template: 'user-list',
        data: expect.objectContaining({
          title: 'Relatório de Usuários',
          users: [
            { id: '1', name: 'User A', email: 'a@t.com', phone: '123', roleName: 'Admin', active: true },
            { id: '2', name: 'User B', email: 'b@t.com', phone: '456', roleName: null, active: false },
          ]
        })
      }));
      expect(result).toBe('pdf_stream_mock');
    });

    it('should default to desc order on created_at if orderBy is not provided', async () => {
      mockRepo.findMany = vi.fn().mockResolvedValue([]);
      await service.exportPdf({});
      expect(mockRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { created_at: 'desc' }
      }));
    });

    it('should throw BadRequestError if orderBy field is invalid', async () => {
      await expect(service.exportPdf({ orderBy: 'invalid_field' })).rejects.toThrow(BadRequestError);
    });

    it('should use default order direction asc when orderBy is provided without orderDirection', async () => {
      mockRepo.findMany = vi.fn().mockResolvedValue([]);
      await service.exportPdf({ orderBy: 'name' });
      expect(mockRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { name: 'asc' }
      }));
    });
  });
});

