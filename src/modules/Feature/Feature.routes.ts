import { FastifyInstance } from 'fastify';
import { FeatureController } from './Feature.controller.js';
import { FeatureService } from './Feature.service.js';
import { FeatureRepository } from './Feature.repository.js';
import { CreateFeatureDTO, UpdateFeatureDTO } from './Feature.schema.js';
import { PaginationParams } from '../../core/index.js';
import { 
  registerGetRoute, 
  registerPostRoute, 
  registerPutRoute, 
  registerDeleteRoute, 
  registerPatchRoute 
} from '../../core/RouteFactory.js';
import { 
  GetFeatureConfig, 
  ListFeaturesConfig, 
  ListAllFeaturesConfig, 
  CreateFeatureConfig, 
  UpdateFeatureConfig, 
  DeleteFeatureConfig, 
  ToggleFeatureStatusConfig 
} from './Feature.config.js';

export async function featureRoutes(fastify: FastifyInstance) {
  const repository = new FeatureRepository();
  const service = new FeatureService(repository);
  const controller = new FeatureController(service);

  registerGetRoute(fastify, '/feature/:id', GetFeatureConfig, controller.getById.bind(controller));
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/feature', ListFeaturesConfig, controller.listItems.bind(controller)
  );
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/feature/all', ListAllFeaturesConfig, controller.listAllItems.bind(controller)
  );
  
  registerPostRoute<CreateFeatureDTO>(fastify, '/feature', CreateFeatureConfig, controller.create.bind(controller));
  
  registerPutRoute<UpdateFeatureDTO, { id: string }>(
    fastify, '/feature/:id', UpdateFeatureConfig, controller.update.bind(controller)
  );
  
  registerDeleteRoute<{ id: string }>(fastify, '/feature/:id', DeleteFeatureConfig, controller.delete.bind(controller));
  
  registerPatchRoute<{ active: boolean }, { id: string }>(
    fastify, '/feature/:id/status', ToggleFeatureStatusConfig, controller.toggleStatus.bind(controller)
  );
}
