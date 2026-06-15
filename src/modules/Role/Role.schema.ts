import { Static, Type } from '@sinclair/typebox';

export const RoleFeatureSchema = Type.Object({
  id_feature: Type.String(),
  create: Type.Boolean(),
  view: Type.Boolean(),
  delete: Type.Boolean(),
  activate: Type.Boolean(),
});

export const RoleResponseSchema = Type.Object({
  id: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  created_at: Type.Optional(Type.Any()),
  updated_at: Type.Optional(Type.Any()),
  is_deleted: Type.Optional(Type.Optional(Type.Boolean())),
  deleted_at: Type.Optional(Type.Optional(Type.Any())),
  RoleFeature: Type.Optional(Type.Array(RoleFeatureSchema)),
});

export type RoleResponse = Static<typeof RoleResponseSchema>;

export const CreateRoleSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  permissions: Type.Array(RoleFeatureSchema),
}, { additionalProperties: false });

export type CreateRoleDTO = Static<typeof CreateRoleSchema>;

export const UpdateRoleSchema = Type.Partial(CreateRoleSchema);

export type UpdateRoleDTO = Static<typeof UpdateRoleSchema>;
