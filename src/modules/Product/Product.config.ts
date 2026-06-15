import { defineRouteConfig } from '../../shared/utils/RouteContract.js';
import { CreateProductSchema, UpdateProductSchema, ProductResponseSchema } from './Product.schema.js';
import { createPaginatedResponseSchema } from '../../shared/utils/schema.util.js';

const TAG = 'Product';
const FEATURE = 'product';

export const ListProductsConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List products',
  response: { 200: createPaginatedResponseSchema(ProductResponseSchema) }
});

export const ListAllProductsConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List ALL products (Paginated, including inactive)',
  response: { 200: createPaginatedResponseSchema(ProductResponseSchema) }
});

export const GetProductConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'Get product by ID',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: ProductResponseSchema }
});

export const CreateProductConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Create product',
  body: CreateProductSchema,
  response: { 201: ProductResponseSchema }
});

export const UpdateProductConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Update product',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: UpdateProductSchema,
  response: { 200: ProductResponseSchema }
});

export const DeleteProductConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'delete',
  tag: TAG,
  summary: 'Delete product',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } } }
});

export const ToggleProductStatusConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'activate',
  tag: TAG,
  summary: 'Toggle product status (active/inactive)',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: {
    type: 'object',
    properties: { active: { type: 'boolean' } },
    required: ['active']
  },
  response: { 200: ProductResponseSchema }
});
