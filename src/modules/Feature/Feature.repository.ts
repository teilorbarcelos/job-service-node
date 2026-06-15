import { Feature, Prisma } from '@prisma/client';
import { BaseRepository } from '../../core/BaseRepository.js';
import { db } from '../../infra/database/PrismaService.js';
import { CreateFeatureDTO, UpdateFeatureDTO } from './Feature.schema.js';

export class FeatureRepository extends BaseRepository<
  Feature,
  CreateFeatureDTO,
  UpdateFeatureDTO,
  Prisma.FeatureDelegate
> {
  constructor() {
    super(db.feature as unknown as Prisma.FeatureDelegate, 'Feature');
  }
}
