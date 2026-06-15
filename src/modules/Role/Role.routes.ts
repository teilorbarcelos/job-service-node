import { FastifyInstance } from 'fastify';
import { PaginationParams } from '../../core/index.js';
import {
  registerDeleteRoute,
  registerGetRoute,
  registerPatchRoute,
  registerPostRoute,
  registerPutRoute
} from '../../core/RouteFactory.js';
import {
  CreateRoleConfig,
  DeleteRoleConfig,
  GetRoleConfig,
  ListAllRolesConfig,
  ListRoleFeaturesConfig,
  ListRolesConfig,
  ToggleRoleStatusConfig,
  UpdateRoleConfig
} from './Role.config.js';
import { RoleController } from './Role.controller.js';
import { RoleRepository } from './Role.repository.js';
import { CreateRoleDTO, UpdateRoleDTO } from './Role.schema.js';
import { RoleService } from './Role.service.js';

export async function roleRoutes(fastify: FastifyInstance) {
  const repository = new RoleRepository();
  const service = new RoleService(repository);
  const controller = new RoleController(service);

  registerGetRoute(fastify, '/role/features', ListRoleFeaturesConfig, controller.listFeatures.bind(controller));
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/role', ListRolesConfig, controller.listItems.bind(controller)
  );
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/role/all', ListAllRolesConfig, controller.listAllItems.bind(controller)
  );

  registerGetRoute(fastify, '/role/:id', GetRoleConfig, controller.getById.bind(controller));
  
  registerPostRoute<CreateRoleDTO>(fastify, '/role', CreateRoleConfig, controller.create.bind(controller));
  
  registerPutRoute<UpdateRoleDTO, { id: string }>(
    fastify, '/role/:id', UpdateRoleConfig, controller.update.bind(controller)
  );
  
  registerDeleteRoute<{ id: string }>(fastify, '/role/:id', DeleteRoleConfig, controller.delete.bind(controller));
  
  registerPatchRoute<{ active: boolean }, { id: string }>(
    fastify, '/role/:id/status', ToggleRoleStatusConfig, controller.toggleStatus.bind(controller)
  );
}
