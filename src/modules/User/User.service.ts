import { Prisma, User } from '@prisma/client';
import { BaseService } from '../../core/BaseService.js';
import { bcryptPool } from '../../infra/bcrypt/BcryptPool.js';
import { businessMetrics } from '../../shared/utils/metrics.js';
import { parseQueryParams, validateOrder } from '../../core/QueryParserHelper.js';
import { SessionManager } from '../../infra/auth/SessionManager.js';
import { emailProvider } from '../../infra/email/EmailProvider.js';
import { pdfProvider } from '../../infra/pdf/PdfProvider.js';
import { CONFIG } from '../../shared/config/env.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { WELCOME_TEMPLATE } from '../../shared/templates/email/email-templates.js';
import { logger } from '../../shared/utils/logger.js';
import { buildWhereClause } from '../../shared/utils/prisma-filter.util.js';
import { UserRepository } from './User.repository.js';
import { CreateUserDTO, UpdateUserDTO } from './User.schema.js';

interface UserCreateInputExtended extends Prisma.UserCreateInput {
  Auth: Prisma.AuthCreateNestedOneWithoutUserInput;
}

interface UserUpdateInputExtended extends Prisma.UserUpdateInput {
  password?: string;
  Auth?: Prisma.AuthUpdateOneWithoutUserNestedInput;
}

export class UserService extends BaseService<
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UserRepository
> {
  constructor(repository: UserRepository) {
    super(repository);

    this.allowFilters([
      { key: 'name', qt: 'contains' },
      { key: 'email', qt: 'equals' },
      { key: 'active', type: 'boolean' },
      { key: 'createdAt', type: 'date', targetKey: 'created_at' },
      { key: 'updatedAt', type: 'date', targetKey: 'updated_at' },
      { key: 'Role.name', qt: 'contains', relation: 'nested' }
    ]);

    this.allowSearch([
      { key: 'name' },
      { key: 'email' },
      { key: 'Role.name', relation: 'nested' }
    ]);
  }

  async create(data: CreateUserDTO): Promise<User> {
    const { id_role, password, ...rest } = data;
    const hashedPassword = await bcryptPool.hash(password, 10);

    const createData: UserCreateInputExtended = {
      ...rest,
      Auth: {
        create: {
          password: hashedPassword,
          active: true
        }
      }
    } as unknown as UserCreateInputExtended;

    if (id_role) {
      createData.Role = { connect: { id: id_role } };
    }

    const user = await this.repository.persistRecord(createData as unknown as CreateUserDTO);

    emailProvider.sendEmail({
      to: user.email,
      subject: 'Bem-vindo ao Sistema!',
      template: WELCOME_TEMPLATE,
      context: {
        name: user.name,
        email: user.email,
        password: password
      }
    }).catch(err => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Erro ao enviar e-mail de boas-vindas');
    });

    return user;
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    const user = await this.repository.findOneById(id);

    if (user && user.email === CONFIG.FIRST_USER) {
      if (data.password) {
        const hashedPassword = await bcryptPool.hash(data.password, 12);
        const updatedRootUser = await super.update(id, {
          Auth: { update: { password: hashedPassword } }
        } as unknown as UpdateUserDTO);
        await SessionManager.invalidateUserSessions(id);
        return updatedRootUser;
      }
      const updatedRootUser = await super.update(id, {} as UpdateUserDTO);
      await SessionManager.invalidateUserSessions(id);
      return updatedRootUser;
    }

    const { id_role, password, ...rest } = data;
    const updateData: UserUpdateInputExtended = { ...rest } as unknown as UserUpdateInputExtended;
    
    if (id_role) {
      updateData.Role = { connect: { id: id_role } };
    }

    if (password) {
      const hashedPassword = await bcryptPool.hash(password, 12);
      updateData.Auth = { update: { password: hashedPassword } };
    }

    const updatedUser = await super.update(id, updateData as unknown as UpdateUserDTO);
    await SessionManager.invalidateUserSessions(id);
    return updatedUser;
  }

  async delete(id: string): Promise<User> {
    const user = await this.repository.findOneById(id);
    if (user && user.email === CONFIG.FIRST_USER) {
      throw new BadRequestError('O usuário administrador inicial não pode ser excluído.');
    }
    // LGPD: Anonymize personal data before soft deleting
    await super.update(id, {
      name: 'Deleted User',
      email: `deleted-${id}@anonymized.local`
    } as unknown as UpdateUserDTO);

    const deletedUser = await super.delete(id);
    await SessionManager.invalidateUserSessions(id);
    return deletedUser;
  }

  async setStatus(id: string, active: boolean): Promise<User> {
    const user = await this.repository.findOneById(id);
    if (user && user.email === CONFIG.FIRST_USER && !active) {
      throw new BadRequestError('O usuário administrador inicial não pode ser desativado.');
    }
    const updatedUser = await super.setStatus(id, active);
    await SessionManager.invalidateUserSessions(id);
    return updatedUser;
  }

  async exportPdf(query: Record<string, unknown>): Promise<ReadableStream<Uint8Array>> {
    const { orderBy, orderDirection } = query;

    const { andRules, orRules } = parseQueryParams(query, this.filterableFields, this.searchableFields);

    validateOrder(orderBy as string | undefined, this.filterableFields);

    const order = orderBy
      ? { [orderBy as string]: orderDirection ?? 'asc' }
      : { created_at: 'desc' as const };

    const where = buildWhereClause({ andRules, orRules, ignoreDefaultFilters: true });

    const users = await this.repository.findMany({
      where,
      include: { Role: true },
      orderBy: order,
    });

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const localTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

    const usersData = users.map(u => {
      const userWithRole = u as unknown as { Role: { name: string } | null };
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        roleName: userWithRole.Role?.name ?? null,
        active: u.active,
      };
    });

    const pdfData = {
      title: 'Relatório de Usuários',
      generatedAt: localTime,
      users: usersData,
    };

    businessMetrics.exportsTotal.labels('pdf').inc();
    return pdfProvider.generatePdf({
      template: 'user-list',
      data: pdfData,
    });
  }
}

