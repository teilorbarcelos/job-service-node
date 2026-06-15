import { FastifyInstance } from 'fastify';
import { UserController } from './User.controller.js';
import { UserService } from './User.service.js';
import { UserRepository } from './User.repository.js';
import { CreateUserDTO, UpdateUserDTO } from './User.schema.js';
import { PaginationParams } from '../../core/index.js';
import { 
  registerGetRoute, 
  registerPostRoute, 
  registerPutRoute, 
  registerDeleteRoute, 
  registerPatchRoute 
} from '../../core/RouteFactory.js';
import { 
  GetUserConfig, 
  ListUsersConfig, 
  ListAllUsersConfig, 
  CreateUserConfig, 
  UpdateUserConfig, 
  DeleteUserConfig, 
  ToggleUserStatusConfig,
  ExportUsersPdfConfig
} from './User.config.js';

export async function userRoutes(fastify: FastifyInstance) {
  const repository = new UserRepository();
  const service = new UserService(repository);
  const controller = new UserController(service);

  registerGetRoute<unknown, Record<string, unknown>>(
    fastify, '/user/export/pdf', ExportUsersPdfConfig, controller.exportPdf.bind(controller)
  );

  registerGetRoute(fastify, '/user/:id', GetUserConfig, controller.getById.bind(controller));
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/user', ListUsersConfig, controller.listItems.bind(controller)
  );
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/user/all', ListAllUsersConfig, controller.listAllItems.bind(controller)
  );
  
  registerPostRoute<CreateUserDTO>(fastify, '/user', CreateUserConfig, controller.create.bind(controller));
  
  registerPutRoute<UpdateUserDTO, { id: string }>(
    fastify, '/user/:id', UpdateUserConfig, controller.update.bind(controller)
  );
  
  registerDeleteRoute<{ id: string }>(fastify, '/user/:id', DeleteUserConfig, controller.delete.bind(controller));
  
  registerPatchRoute<{ active: boolean }, { id: string }>(
    fastify, '/user/:id/status', ToggleUserStatusConfig, controller.toggleStatus.bind(controller)
  );
}
