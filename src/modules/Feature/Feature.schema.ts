import { Type, Static } from '@sinclair/typebox';
import { Prisma } from '@prisma/client';

export const FeatureResponseSchema = Type.Object({
  id: Type.Optional(Type.String({ format: 'uuid' })),
  name: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  created_at: Type.Optional(Type.String({ format: 'date-time' })),
  updated_at: Type.Optional(Type.String({ format: 'date-time' })),
  RoleFeature: Type.Optional(Type.String()),
});

export type FeatureResponse = Static<typeof FeatureResponseSchema>;

export const CreateFeatureSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
  RoleFeature: Type.String(),
});

export type CreateFeatureDTO = Static<typeof CreateFeatureSchema>;

export const UpdateFeatureSchema = Type.Partial(CreateFeatureSchema);

export type UpdateFeatureDTO = Static<typeof UpdateFeatureSchema>;

type CreateAdditionalProps = Record<string, never>;
type UpdateAdditionalProps = Record<string, never>;

const _vCreate: Exclude<keyof CreateFeatureDTO, keyof CreateAdditionalProps> extends keyof Prisma.FeatureUncheckedCreateInput ? true : "Error: Field in CreateFeatureDTO does not exist in Prisma" = true;
const _vUpdate: Exclude<keyof UpdateFeatureDTO, keyof UpdateAdditionalProps> extends keyof Prisma.FeatureUncheckedUpdateInput ? true : "Error: Field in UpdateFeatureDTO does not exist in Prisma" = true;
