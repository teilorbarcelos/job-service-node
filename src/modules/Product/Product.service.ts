import { Product } from '@prisma/client';
import { BaseService } from '../../core/BaseService.js';
import { ProductRepository } from './Product.repository.js';
import { CreateProductDTO, UpdateProductDTO } from './Product.schema.js';

export class ProductService extends BaseService<
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  ProductRepository
> {
  constructor(repository: ProductRepository) {
    super(repository);

    this.allowFilters([
      { key: 'name', qt: 'contains' },
      { key: 'sku', qt: 'equals' },
      { key: 'category', qt: 'equals' },
      { key: 'active', type: 'boolean' },
      { key: 'createdAt', type: 'date', targetKey: 'created_at' },
      { key: 'updatedAt', type: 'date', targetKey: 'updated_at' }
    ]);

    this.allowSearch([
      { key: 'name' },
      { key: 'sku' },
      { key: 'category' }
    ]);
  }
}
