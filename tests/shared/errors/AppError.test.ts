import { describe, it, expect } from 'vitest';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/shared/errors/AppError.js';

describe('AppError hierarchy', () => {
  it('AppError deve expor message, statusCode, name e details', () => {
    const e = new AppError('msg', 500, 'CustomName', { foo: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('msg');
    expect(e.statusCode).toBe(500);
    expect(e.name).toBe('CustomName');
    expect(e.details).toEqual({ foo: 1 });
  });

  it('AppError deve usar nome da classe quando name omitido', () => {
    const e = new AppError('m', 500);
    expect(e.name).toBe('AppError');
  });

  it('NotFoundError → 404', () => {
    const e = new NotFoundError();
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe('NotFoundError');
    expect(e.message).toBe('Resource not found');
  });

  it('NotFoundError aceita details', () => {
    const e = new NotFoundError('nope', { id: 'x' });
    expect(e.details).toEqual({ id: 'x' });
  });

  it('ConflictError → 409', () => {
    const e = new ConflictError();
    expect(e.statusCode).toBe(409);
  });

  it('ForbiddenError → 403', () => {
    const e = new ForbiddenError();
    expect(e.statusCode).toBe(403);
  });

  it('UnauthorizedError → 401', () => {
    const e = new UnauthorizedError();
    expect(e.statusCode).toBe(401);
  });

  it('BadRequestError → 400', () => {
    const e = new BadRequestError('bad');
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe('bad');
  });

  it('ValidationError → 422', () => {
    const e = new ValidationError('invalid');
    expect(e.statusCode).toBe(422);
    expect(e.message).toBe('invalid');
  });
});
