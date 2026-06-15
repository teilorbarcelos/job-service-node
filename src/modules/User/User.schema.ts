import { Prisma } from '@prisma/client';
import { Static, Type } from '@sinclair/typebox';

export const UserResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: 'email' })),
  phone: Type.Optional(Type.String()),
  document: Type.Optional(Type.String()),
  avatar: Type.Optional(Type.String()),
  id_role: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
  created_at: Type.Optional(Type.String({ format: 'date-time' })),
  updated_at: Type.Optional(Type.String({ format: 'date-time' })),
});

export type UserResponse = Static<typeof UserResponseSchema>;

export const CreateUserSchema = Type.Object({
  name: Type.String(),
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 6 }),
  phone: Type.Optional(Type.String()),
  document: Type.Optional(Type.String()),
  avatar: Type.Optional(Type.String()),
  id_role: Type.String(),
});

export type CreateUserDTO = Static<typeof CreateUserSchema>;

export const UpdateUserSchema = Type.Partial(
  Type.Intersect([
    CreateUserSchema,
    Type.Object({
      active: Type.Boolean(),
      password: Type.String(),
    }),
  ])
);

export type UpdateUserDTO = Static<typeof UpdateUserSchema>;

type CreateAdditionalProps = {
  password: string;
};
type UpdateAdditionalProps = {
  password: string;
};

const _vCreate: Exclude<keyof CreateUserDTO, keyof CreateAdditionalProps> extends keyof Prisma.UserUncheckedCreateInput ? true : "Error: Field in CreateUserDTO does not exist in Prisma" = true;
const _vUpdate: Exclude<keyof UpdateUserDTO, keyof UpdateAdditionalProps> extends keyof Prisma.UserUncheckedUpdateInput ? true : "Error: Field in UpdateUserDTO does not exist in Prisma" = true;
