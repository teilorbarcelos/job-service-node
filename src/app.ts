import fastifyCompress from '@fastify/compress';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import crypto from 'node:crypto';

import { auditLogHook, setAuditBuffer } from './api/hooks/audit.hook.js';
import { authenticate, errorHandler } from './api/hooks/auth.hook.js';
import { metricsPlugin } from './api/hooks/metrics.js';
import { AuthPayload } from './infra/auth/AuthProvider.js';
import { redis } from './infra/database/RedisProvider.js';
import { registerPrivateModules, registerPublicModules } from './modules/register-modules.js';
import { CONFIG } from './shared/config/env.js';

import { execSync } from 'node:child_process';
import { bootstrapSystem } from './shared/utils/bootstrap.js';
import { registerShutdownHandlers } from './shared/utils/shutdown.js';
import { checkReadiness } from './shared/utils/health.js';
import { auditBuffer } from './infra/audit/AuditBuffer.js';
import { runWithContext } from './shared/utils/requestContext.js';
import { logger } from './shared/utils/logger.js';
import { messagingProvider } from './infra/messaging/RabbitMQProvider.js';

// Triggering hot reload for PDF integration
export function buildApp() {
  const app = Fastify({
    genReqId: () => crypto.randomUUID(),
    logger: CONFIG.ENVIRONMENT !== 'test'
      ? { level: CONFIG.LOG_LEVEL, redact: ['req.headers.authorization', 'req.body.password'] }
      : false,
    disableRequestLogging: true,
  });

  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    runWithContext({ requestId: request.id, signal: (request.raw as { signal?: AbortSignal }).signal }, () => {
      if (request.url !== '/metrics') {
        request.log.info({ url: request.url, method: request.method }, 'Incoming request');
      }
      done();
    });
  });

  setAuditBuffer(auditBuffer);
  app.addHook('onSend', auditLogHook);
  if (process.env.NODE_ENV !== 'test') {
    auditBuffer.start();
  }
  app.register(metricsPlugin);

  const isDev = CONFIG.ENVIRONMENT === 'local' || CONFIG.ENVIRONMENT === 'development';
  let corsOrigin: boolean | string[] = true;
  if (!isDev) {
    corsOrigin = CONFIG.CORS_ORIGINS
      ? CONFIG.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
      : [];
  }

  app.register(fastifyCors, {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });
  app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "connect-src": ["'self'", ...(isDev ? ["http://localhost:*", "ws://localhost:*"] : [])],
      },
    },
  });

  app.register(fastifyCompress, { global: true, threshold: 1024 });

  app.register(fastifyJwt, {
    secret: CONFIG.JWT.SECRET,
  });

  /* istanbul ignore next 14 */
  if (CONFIG.RATE_LIMIT.ENABLED && process.env.NODE_ENV !== 'test') {
    app.register(fastifyRateLimit, {
      max: CONFIG.RATE_LIMIT.MAX,
      timeWindow: CONFIG.RATE_LIMIT.TIME_WINDOW,
      redis: redis,
      keyGenerator: (request) => {
        return (request.user as AuthPayload)?.id || request.ip;
      },
      errorResponseBuilder: () => {
        return {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Você excedeu o limite de requisições. Tente novamente em breve.'
        };
      }
    });
  }
  /* istanbul ignore next */

  app.setErrorHandler(errorHandler);

  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Backend API',
        description: 'Account Management Service',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  app.register(fastifySwaggerUi, {
    routePrefix: '/v1/docs',
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  app.get('/v1/docs/index.html', async (_request, reply) => {
    return reply.redirect('/v1/docs/');
  });

  app.register(registerPublicModules);

  app.register(async (protectedGroup) => {
    protectedGroup.addHook('onRequest', authenticate);
    await registerPrivateModules(protectedGroup);
  });

  app.get('/health', async (_request, reply) => {
    const result = await checkReadiness();
    if (result.status === 'unhealthy') {
      return reply.status(503).send(result);
    }
    return result;
  });

  app.get('/liveness', async () => ({
    status: 'alive',
    uptime: process.uptime(),
  }));

  app.addHook('onReady', async () => {
    if (!CONFIG.PROVIDERS.MESSAGING.ENABLED) return;
    await messagingProvider.connect();
  });

  app.addHook('onClose', async () => {
    await messagingProvider.disconnect();
  });

  registerShutdownHandlers(app);

  return app;
}

export async function start(): Promise<void> {
  logger.info('📦 Sincronizando banco de dados (Migrations, Types & Seed)...');
  try {
    execSync('npm run prisma:gen', { stdio: 'inherit' });
    execSync('npm run prisma:deploy', { stdio: 'inherit' });
  } catch (err) {
    logger.warn({ err }, '⚠️ Falha na sincronização automática do banco. Verifique se o Docker está rodando.');
  }

  await bootstrapSystem();

  const app = buildApp();

  try {
    await app.listen({ port: CONFIG.PORT, host: CONFIG.HOST });
    app.log.info({ port: CONFIG.PORT }, 'Server ready');
    app.log.info({ port: CONFIG.PORT }, 'Documentation available');
    app.log.info({ port: CONFIG.PORT }, 'Audit explorer available');

    console.log('\n--- Endpoints Disponíveis ---');
    console.log(app.printRoutes());
    console.log('-----------------------------\n');
  } catch (err) {
    app.log.error({ err }, 'Falha ao iniciar o servidor');
    process.exit(1);
  }
}

