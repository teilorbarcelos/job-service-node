import { describe, it, expect } from 'vitest';
import { AppError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ValidationError, ConflictError } from '@/shared/errors/index.js';

describe('AppError', () => {
  it('should create an AppError with correct properties', () => {
    const error = new AppError('Test error', 400, 'TEST_ERROR', { foo: 'bar' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('TEST_ERROR');
    expect(error.details).toEqual({ foo: 'bar' });
  });

  it('should have correct default name', () => {
    const error = new AppError('Test error', 400);
    expect(error.name).toBe('AppError');
  });
});

describe('Specialized Errors', () => {
  it('BadRequestError should have status 400', () => {
    const error = new BadRequestError('Bad Request');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('BadRequestError');
  });

  it('UnauthorizedError should have status 401', () => {
    const error = new UnauthorizedError('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('UnauthorizedError');
  });

  it('ForbiddenError should have status 403', () => {
    const error = new ForbiddenError('Forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe('ForbiddenError');
  });

  it('NotFoundError should have status 404', () => {
    const error = new NotFoundError('Not Found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('NotFoundError');
  });

  it('ValidationError should have status 422', () => {
    const error = new ValidationError('Validation Failed', { field: 'required' });
    expect(error.statusCode).toBe(422);
    expect(error.name).toBe('ValidationError');
    expect(error.details).toEqual({ field: 'required' });
  });

  it('ConflictError should have status 409', () => {
    const error = new ConflictError('Conflict');
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('ConflictError');
  });

  it('should use default messages for specialized errors', () => {
    expect(new NotFoundError().message).toBe('Resource not found');
    expect(new ConflictError().message).toBe('Resource conflict');
    expect(new ForbiddenError().message).toBe('Forbidden');
    expect(new UnauthorizedError().message).toBe('Unauthorized');
  });
});
