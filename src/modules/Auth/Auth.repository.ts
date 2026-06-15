import { Prisma, Auth } from '@prisma/client';
import { db } from '../../infra/database/PrismaService.js';
import { BaseRepository } from '../../core/BaseRepository.js';

export type AuthWithRelations = Prisma.AuthGetPayload<{
  include: {
    User: {
      include: {
        Role: {
          include: {
            RoleFeature: true
          }
        }
      }
    }
  }
}>;

export class AuthRepository extends BaseRepository<
  Auth,
  Prisma.AuthUncheckedCreateInput,
  Prisma.AuthUncheckedUpdateInput,
  typeof db.auth
> {
  constructor() {
    super(db.auth, 'Auth');
  }

  async findByEmail(email: string): Promise<AuthWithRelations | null> {
    return db.auth.findFirst({
      where: {
        User: {
          email: email
        }
      },
      include: {
        User: {
          include: {
            Role: {
              include: {
                RoleFeature: true
              }
            }
          }
        }
      }
    });
  }

  async updateToken(id: string, token: string, expiration: Date) {
    return db.auth.update({
      where: { id },
      data: {
        request_password_token: token,
        request_password_expiration: expiration
      }
    });
  }
}
