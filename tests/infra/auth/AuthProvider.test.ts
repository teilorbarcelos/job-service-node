import { describe, it, expect, vi } from 'vitest';
import { JWTAuthProvider, AuthPayload } from '@/infra/auth/AuthProvider.js';
import { FastifyInstance } from 'fastify';

describe('JWTAuthProvider', () => {
  const mockFastify = {
    jwt: {
      sign: vi.fn().mockReturnValue('mock-token'),
      verify: vi.fn().mockReturnValue({ id: '1', email: 'test@test.com' } as AuthPayload),
    },
  } as unknown as FastifyInstance;

  const provider = new JWTAuthProvider(mockFastify);
  const payload: AuthPayload = { id: '1', email: 'test@test.com', roleId: 'role-1' };

  it('should generate a token', async () => {
    const token = await provider.generateToken(payload);
    expect(token).toBe('mock-token');
    expect(mockFastify.jwt.sign).toHaveBeenCalledWith(payload, expect.objectContaining({ expiresIn: '15m' }));
  });

  it('should generate a token pair', async () => {
    const pair = await provider.generateTokenPair(payload);
    expect(pair.token).toBe('mock-token');
    expect(pair.refreshToken).toBe('mock-token');
    expect(mockFastify.jwt.sign).toHaveBeenCalledTimes(3);
  });

  it('should verify a token', async () => {
    const result = await provider.verifyToken('some-token');
    expect(result).toEqual({ id: '1', email: 'test@test.com' });
    expect(mockFastify.jwt.verify).toHaveBeenCalledWith('some-token');
  });
});
