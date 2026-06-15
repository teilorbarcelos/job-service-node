import { Product, Prisma } from '@prisma/client';
import { BaseRepository } from '../../core/BaseRepository.js';
import { db } from '../../infra/database/PrismaService.js';
import { CreateProductDTO, UpdateProductDTO } from './Product.schema.js';

export class ProductRepository extends BaseRepository<
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  Prisma.ProductDelegate
> {
  constructor() {
    super(db.product as unknown as Prisma.ProductDelegate, 'Product');
  }
}
