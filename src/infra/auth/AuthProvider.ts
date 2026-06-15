export interface AuthPayload {
  id: string;
  email: string;
  roleId: string;
  permissions?: Array<{
    feature: string;
    create: boolean;
    view: boolean;
    delete: boolean;
    activate: boolean;
  }>;
}

export interface TokenPair {
  token: string;
  refreshToken: string;
}

export interface AuthProvider {
  name: string;
  generateToken(payload: AuthPayload, expiresIn?: string): Promise<string>;
  generateTokenPair(payload: AuthPayload): Promise<TokenPair>;
  verifyToken(token: string): Promise<AuthPayload>;
}

import { FastifyInstance } from 'fastify';
import { CONFIG } from '../../shared/config/env.js';

export class JWTAuthProvider implements AuthProvider {
  readonly name = 'JWT';

  constructor(private fastify: FastifyInstance) {}

  async generateToken(payload: AuthPayload, expiresIn?: string): Promise<string> {
    return this.fastify.jwt.sign(payload, { expiresIn: expiresIn ?? CONFIG.JWT.EXPIRES_IN });
  }

  async generateTokenPair(payload: AuthPayload): Promise<TokenPair> {
    const token = await this.generateToken(payload, CONFIG.JWT.EXPIRES_IN);
    const refreshToken = await this.generateToken(payload, CONFIG.JWT.REFRESH_EXPIRES_IN);
    return { token, refreshToken };
  }

  async verifyToken(token: string): Promise<AuthPayload> {
    return this.fastify.jwt.verify<AuthPayload>(token);
  }
}
