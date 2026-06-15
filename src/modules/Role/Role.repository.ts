import { Role, Prisma } from '@prisma/client';
import { BaseRepository } from '../../core/BaseRepository.js';
import { db } from '../../infra/database/PrismaService.js';
import { CreateRoleDTO, UpdateRoleDTO } from './Role.schema.js';
import { slugify } from '../../shared/utils/slugify.js';

export class RoleRepository extends BaseRepository<
  Role,
  CreateRoleDTO,
  UpdateRoleDTO,
  Prisma.RoleDelegate
> {
  constructor() {
    super(db.role as unknown as Prisma.RoleDelegate, 'Role');
  }

  async persistRecord(data: CreateRoleDTO): Promise<Role> {
    const { permissions, ...roleData } = data;
    const id = slugify(roleData.name);

    return db.role.create({
      data: {
        ...roleData,
        id,
        RoleFeature: {
          create: permissions.map(p => ({
            id_feature: p.id_feature,
            create: p.create,
            view: p.view,
            delete: p.delete,
            activate: p.activate,
          }))
        }
      },
      include: {
        RoleFeature: true
      }
    }) as unknown as Role;
  }

  async updateRecordDetails(id: string, data: UpdateRoleDTO): Promise<Role> {
    const { permissions, ...roleData } = data;

    return db.role.update({
      where: { id },
      data: {
        ...roleData,
        RoleFeature: permissions ? {
          deleteMany: {},
          create: permissions.map(p => ({
            id_feature: p.id_feature,
            create: p.create,
            view: p.view,
            delete: p.delete,
            activate: p.activate,
          }))
        } : undefined
      },
      include: {
        RoleFeature: true
      }
    }) as unknown as Role;
  }

  async findOneById(id: string): Promise<Role | null> {
    return db.role.findUnique({
      where: { id },
      include: {
        RoleFeature: true
      }
    }) as unknown as Role | null;
  }

}
