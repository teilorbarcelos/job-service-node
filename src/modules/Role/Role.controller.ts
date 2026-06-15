import { Role } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { BaseController } from '../../core/BaseController.js';
import { RoleService } from './Role.service.js';
import { CreateRoleDTO, UpdateRoleDTO } from './Role.schema.js';

export class RoleController extends BaseController<
  Role,
  CreateRoleDTO,
  UpdateRoleDTO,
  RoleService
> {
  constructor(service: RoleService) {
    super(service);
  }

  async listFeatures(_request: FastifyRequest, reply: FastifyReply) {
    const features = await this.service.listFeatures();
    return reply.send(features);
  }
}
