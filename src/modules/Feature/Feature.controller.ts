import { Feature } from '@prisma/client';
import { BaseController } from '../../core/BaseController.js';
import { FeatureService } from './Feature.service.js';
import { CreateFeatureDTO, UpdateFeatureDTO } from './Feature.schema.js';

export class FeatureController extends BaseController<
  Feature,
  CreateFeatureDTO,
  UpdateFeatureDTO,
  FeatureService
> {
  constructor(service: FeatureService) {
    super(service);
  }
}
