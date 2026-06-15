import { FastifyReply, FastifyRequest } from 'fastify';
import { Product } from '@prisma/client';
import { BaseController } from '../../core/BaseController.js';
import { ProductService } from './Product.service.js';
import { CreateProductDTO, UpdateProductDTO } from './Product.schema.js';
import { AuthPayload } from '../../infra/auth/AuthProvider.js';

export class ProductController extends BaseController<
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  ProductService
> {
  constructor(service: ProductService) {
    super(service);
  }

  override async create(
    request: FastifyRequest<{ Body: CreateProductDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.user as AuthPayload | undefined;
    const data = {
      ...request.body,
      id_user: user?.id,
    };
    const result = await this.service.create(data);
    return reply.status(201).send(result);
  }
}
