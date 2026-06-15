import { defineRouteConfig } from '../../shared/utils/RouteContract.js';
import { CreateRoleSchema, UpdateRoleSchema, RoleResponseSchema } from './Role.schema.js';
import { createPaginatedResponseSchema } from '../../shared/utils/schema.util.js';
import { Type } from '@sinclair/typebox';

const TAG = 'Role';
const FEATURE = 'role';

export const ListRolesConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List roles',
  response: { 200: createPaginatedResponseSchema(RoleResponseSchema) }
});

export const ListAllRolesConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List ALL roles (Paginated, including inactive)',
  response: { 200: createPaginatedResponseSchema(RoleResponseSchema) }
});

export const GetRoleConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'Get role by ID',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: RoleResponseSchema }
});

export const CreateRoleConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Create role',
  body: CreateRoleSchema,
  response: { 201: RoleResponseSchema }
});

export const UpdateRoleConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'create',
  tag: TAG,
  summary: 'Update role',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: UpdateRoleSchema,
  response: { 200: RoleResponseSchema }
});

export const DeleteRoleConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'delete',
  tag: TAG,
  summary: 'Delete role',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  response: { 200: { type: 'object', properties: { success: { type: 'boolean' } } } }
});

export const ToggleRoleStatusConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'activate',
  tag: TAG,
  summary: 'Toggle role status',
  params: {
    type: 'object',
    properties: { id: { type: 'string' } }
  },
  body: {
    type: 'object',
    properties: { active: { type: 'boolean' } },
    required: ['active']
  },
  response: { 200: RoleResponseSchema }
});

export const ListRoleFeaturesConfig = defineRouteConfig({
  feature: FEATURE,
  action: 'view',
  tag: TAG,
  summary: 'List available features',
  response: { 
    200: Type.Array(Type.Object({
      id: Type.String(),
      name: Type.String()
    }))
  }
});
