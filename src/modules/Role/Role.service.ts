import { Role } from '@prisma/client';
import { BaseService } from '../../core/BaseService.js';
import { RoleRepository } from './Role.repository.js';
import { CreateRoleDTO, UpdateRoleDTO } from './Role.schema.js';
import { db } from '../../infra/database/PrismaService.js';
import { SessionManager } from '../../infra/auth/SessionManager.js';

export class RoleService extends BaseService<
  Role,
  CreateRoleDTO,
  UpdateRoleDTO,
  RoleRepository
> {
  constructor(repository: RoleRepository) {
    super(repository);

    this.allowFilters([
      { key: 'name', qt: 'contains' },
      { key: 'description', qt: 'contains' },
      { key: 'active', type: 'boolean' },
      { key: 'createdAt', type: 'date', targetKey: 'created_at' },
      { key: 'updatedAt', type: 'date', targetKey: 'updated_at' }
    ]);

    this.allowSearch([
      { key: 'name' },
      { key: 'description' }
    ]);
  }

  async listFeatures() {
    return db.feature.findMany({
      where: { active: true }
    });
  }

  private async invalidateSessions(roleId: string) {
    const users = await db.user.findMany({
      where: { id_role: roleId },
      select: { id: true }
    });
    
    const userIds = users.map(u => u.id);
    await SessionManager.invalidateManyUsersSessions(userIds);
  }

  async update(id: string, data: UpdateRoleDTO): Promise<Role> {
    const updated = await super.update(id, data);
    await this.invalidateSessions(id);
    return updated;
  }

  async delete(id: string): Promise<Role> {
    const deleted = await super.delete(id);
    await this.invalidateSessions(id);
    return deleted;
  }

  async setStatus(id: string, active: boolean): Promise<Role> {
    const updated = await super.setStatus(id, active);
    await this.invalidateSessions(id);
    return updated;
  }
}
