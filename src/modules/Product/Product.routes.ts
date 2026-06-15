import { FastifyInstance } from 'fastify';
import { ProductController } from './Product.controller.js';
import { ProductService } from './Product.service.js';
import { ProductRepository } from './Product.repository.js';
import { CreateProductDTO, UpdateProductDTO } from './Product.schema.js';
import { PaginationParams } from '../../core/index.js';
import { 
  registerGetRoute, 
  registerPostRoute, 
  registerPutRoute, 
  registerDeleteRoute, 
  registerPatchRoute 
} from '../../core/RouteFactory.js';
import { 
  GetProductConfig, 
  ListProductsConfig, 
  ListAllProductsConfig, 
  CreateProductConfig, 
  UpdateProductConfig, 
  DeleteProductConfig, 
  ToggleProductStatusConfig 
} from './Product.config.js';

export async function productRoutes(fastify: FastifyInstance) {
  const repository = new ProductRepository();
  const service = new ProductService(repository);
  const controller = new ProductController(service);

  registerGetRoute(fastify, '/product/:id', GetProductConfig, controller.getById.bind(controller));
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/product', ListProductsConfig, controller.listItems.bind(controller)
  );
  
  registerGetRoute<unknown, PaginationParams & Record<string, unknown>>(
    fastify, '/product/all', ListAllProductsConfig, controller.listAllItems.bind(controller)
  );
  
  registerPostRoute<CreateProductDTO>(fastify, '/product', CreateProductConfig, controller.create.bind(controller));
  
  registerPutRoute<UpdateProductDTO, { id: string }>(
    fastify, '/product/:id', UpdateProductConfig, controller.update.bind(controller)
  );
  
  registerDeleteRoute<{ id: string }>(fastify, '/product/:id', DeleteProductConfig, controller.delete.bind(controller));
  
  registerPatchRoute<{ active: boolean }, { id: string }>(
    fastify, '/product/:id/status', ToggleProductStatusConfig, controller.toggleStatus.bind(controller)
  );
}
