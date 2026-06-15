import { defineRouteConfig } from '../../shared/utils/RouteContract.js';
import { CreateUserSchema, UpdateUserSchema, UserResponseSchema } from './User.schema.js';
import { createPaginatedResponseSchema } from '../../shared/utils/schema.util.js';

const TAG = 'User';
const FEATURE = 'user';

export const ListUsersConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List users',
  response: { 200: createPaginatedResponseSchema(UserResponseSchema) }
});

export const ListAllUsersConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List ALL users (Paginated, including inactive)',
  response: { 200: createPaginatedResponseSchema(UserResponseSchema) }
});

export const GetUserConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'Get user by ID',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: UserResponseSchema }
});

export const CreateUserConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Create user',
  body: CreateUserSchema,
  response: { 201: UserResponseSchema }
});

export const UpdateUserConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Update user',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: UpdateUserSchema,
  response: { 200: UserResponseSchema }
});

export const DeleteUserConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'delete',
  tag: TAG,
  summary: 'Delete user',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } } }
});

export const ToggleUserStatusConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'activate',
  tag: TAG,
  summary: 'Toggle user status',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: { active: { type: 'boolean' } },
    required: ['active'],
  },
  response: { 200: UserResponseSchema },
});

export const ExportUsersPdfConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'Export users to PDF',
  response: {
    200: {
      type: 'string',
      description: 'PDF report stream',
    },
  },
  rateLimit: { max: 10, timeWindow: '1 minute' },
});

