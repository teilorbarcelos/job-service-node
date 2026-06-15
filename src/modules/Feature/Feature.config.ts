import { defineRouteConfig } from '../../shared/utils/RouteContract.js';
import { createPaginatedResponseSchema } from '../../shared/utils/schema.util.js';
import { CreateFeatureSchema, FeatureResponseSchema, UpdateFeatureSchema } from './Feature.schema.js';

const TAG = 'Feature';
const FEATURE = 'feature';

export const ListFeaturesConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List features',
  response: { 200: createPaginatedResponseSchema(FeatureResponseSchema) }
});

export const ListAllFeaturesConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List ALL features (Paginated, including inactive)',
  response: { 200: createPaginatedResponseSchema(FeatureResponseSchema) }
});

export const GetFeatureConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'Get feature by ID',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: FeatureResponseSchema }
});

export const CreateFeatureConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Create feature',
  body: CreateFeatureSchema,
  response: { 201: FeatureResponseSchema }
});

export const UpdateFeatureConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Update feature',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: UpdateFeatureSchema,
  response: { 200: FeatureResponseSchema }
});

export const DeleteFeatureConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'delete',
  tag: TAG,
  summary: 'Delete feature',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } } }
});

export const ToggleFeatureStatusConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'activate',
  tag: TAG,
  summary: 'Toggle feature status',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: {
    type: 'object',
    properties: { active: { type: 'boolean' } },
    required: ['active']
  },
  response: { 200: FeatureResponseSchema }
});
