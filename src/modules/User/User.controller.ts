import { User } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { BaseController } from '../../core/BaseController.js';
import { UserService } from './User.service.js';
import { CreateUserDTO, UpdateUserDTO } from './User.schema.js';

export class UserController extends BaseController<
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UserService
> {
  constructor(service: UserService) {
    super(service);
  }

  async exportPdf(
    request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
    reply: FastifyReply
  ): Promise<void> {
    const stream = await this.service.exportPdf(request.query);
    return reply
      .type('application/pdf')
      .header('Content-Disposition', 'attachment; filename="usuarios.pdf"')
      .send(stream);
  }
}

