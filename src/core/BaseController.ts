import { FastifyReply, FastifyRequest } from 'fastify';
import { BaseRepository, PaginationParams, PrismaDelegate } from './BaseRepository.js';
import { BaseService } from './BaseService.js';
export abstract class BaseController<
  T extends { id: string },
  CreateDTO,
  UpdateDTO,
  S extends BaseService<T, CreateDTO, UpdateDTO, BaseRepository<T, CreateDTO, UpdateDTO, PrismaDelegate<T>>>
> {
  constructor(protected service: S) {}

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const result = await this.service.retrieveById(id);
    if (!result) {
      return reply.status(404).send({ message: 'Record not found' });
    }
    return reply.send(result);
  }

  async listItems(
    request: FastifyRequest<{ Querystring: PaginationParams & Record<string, unknown> }>,
    reply: FastifyReply
  ): Promise<void> {

    const result = await this.service.listItems(request.query);
    return reply.send(result);
  }

  async listAllItems(
    request: FastifyRequest<{ Querystring: PaginationParams & Record<string, unknown> }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.service.listAllItems(request.query);
    return reply.send(result);
  }

  async create(request: FastifyRequest<{ Body: CreateDTO }>, reply: FastifyReply): Promise<void> {
    const result = await this.service.create(request.body as CreateDTO);
    return reply.status(201).send(result);
  }

  async update(
    request: FastifyRequest<{ Params: { id: string }; Body: UpdateDTO }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;
    const result = await this.service.update(id, request.body as UpdateDTO);
    return reply.send(result);
  }

  async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    await this.service.delete(id);
    return reply.status(204).send();
  }

  async toggleStatus(
    request: FastifyRequest<{ Params: { id: string }; Body: { active: boolean } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { id } = request.params;
    const { active } = request.body;
    const result = await this.service.setStatus(id, active);
    return reply.send(result);
  }
}
