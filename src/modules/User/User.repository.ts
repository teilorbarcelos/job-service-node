import { User, Prisma } from '@prisma/client';
import { BaseRepository } from '../../core/BaseRepository.js';
import { db } from '../../infra/database/PrismaService.js';
import { CreateUserDTO, UpdateUserDTO } from './User.schema.js';

export class UserRepository extends BaseRepository<
  User,
  CreateUserDTO,
  UpdateUserDTO,
  Prisma.UserDelegate
> {
  constructor() {
    super(db.user as unknown as Prisma.UserDelegate, 'User');
  }
}
