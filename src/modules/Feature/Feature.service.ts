import { Feature } from '@prisma/client';
import { BaseService } from '../../core/BaseService.js';
import { FeatureRepository } from './Feature.repository.js';
import { CreateFeatureDTO, UpdateFeatureDTO } from './Feature.schema.js';

export class FeatureService extends BaseService<
  Feature,
  CreateFeatureDTO,
  UpdateFeatureDTO,
  FeatureRepository
> {
  constructor(repository: FeatureRepository) {
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
}
