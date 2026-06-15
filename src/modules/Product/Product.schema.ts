import { Prisma } from '@prisma/client';
import { Static, Type } from '@sinclair/typebox';

export const ProductResponseSchema = Type.Object({
  id: Type.Optional(Type.String({ format: 'uuid' })),
  name: Type.Optional(Type.String()),
  sku: Type.Optional(Type.String()),
  category: Type.Optional(Type.String()),
  price: Type.Optional(Type.Number()),
  stock: Type.Optional(Type.Integer()),
  description: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  created_at: Type.Optional(Type.String({ format: 'date-time' })),
  updated_at: Type.Optional(Type.String({ format: 'date-time' })),
  is_deleted: Type.Optional(Type.Optional(Type.Boolean())),
  deleted_at: Type.Optional(Type.Optional(Type.String({ format: 'date-time' }))),
  id_user: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
});

export type ProductResponse = Static<typeof ProductResponseSchema>;

export const CreateProductSchema = Type.Object({
  name: Type.String(),
  sku: Type.String(),
  category: Type.String(),
  price: Type.Number(),
  stock: Type.Integer(),
  description: Type.String(),
  id_user: Type.Optional(Type.String({ format: 'uuid' })),
});

export type CreateProductDTO = Static<typeof CreateProductSchema>;

export const UpdateProductSchema = Type.Partial(CreateProductSchema);

export type UpdateProductDTO = Static<typeof UpdateProductSchema>;

type CreateAdditionalProps = Record<string, never>;
type UpdateAdditionalProps = Record<string, never>;

const _vCreate: Exclude<keyof CreateProductDTO, keyof CreateAdditionalProps> extends keyof Prisma.ProductUncheckedCreateInput ? true : "Error: Field in CreateProductDTO does not exist in Prisma" = true;
const _vUpdate: Exclude<keyof UpdateProductDTO, keyof UpdateAdditionalProps> extends keyof Prisma.ProductUncheckedUpdateInput ? true : "Error: Field in UpdateProductDTO does not exist in Prisma" = true;
