import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'local']).default('development'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ENVIRONMENT: z.string().default('local'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(30000),
  JOB_EXECUTION_TIMEOUT_MS: z.coerce.number().default(300000),

  DATABASE_URL: z.string().default('postgresql://postgres:postgrespw@localhost:5432/backend_node?schema=public'), // NOSONAR - dev default, sobrescrito via .env em produção
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),
  DATABASE_POOL_CONNECTION_TIMEOUT: z.coerce.number().default(5000),
  DATABASE_QUERY_TIMEOUT: z.coerce.number().default(10000),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().default(0),
  REDIS_COMMAND_TIMEOUT: z.coerce.number().default(5000),

  MESSAGING_ENABLED: z.enum(['true', 'false']).default('false'),
  RABBIT_URL: z.string().default('amqp://localhost'),
  RABBIT_USER: z.string().default('guest'),
  RABBIT_PASSWORD: z.string().default('guest'),
  RABBITMQ_PUBLISH_TIMEOUT: z.coerce.number().default(5000),

  HEALTH_CHECK_CRON: z.string().default('*/1 * * * *'),
  HEALTH_CHECK_ENABLED: z.enum(['true', 'false']).default('true'),
}).refine(
  (data) => !(data.MESSAGING_ENABLED === 'true' && !data.RABBIT_URL),
  {
    message: 'RABBIT_URL é obrigatório quando MESSAGING_ENABLED=true',
    path: ['RABBIT_URL'],
  }
);

export type EnvSchema = z.infer<typeof envSchema>;

function parseEnv(): EnvSchema {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    throw new Error('Environment validation failed');
  }
  return result.data;
}

const _env = parseEnv();

export const CONFIG = {
  LOG_LEVEL: _env.LOG_LEVEL,
  ENVIRONMENT: _env.ENVIRONMENT,
  SHUTDOWN_TIMEOUT_MS: _env.SHUTDOWN_TIMEOUT_MS,
  JOB_EXECUTION_TIMEOUT_MS: _env.JOB_EXECUTION_TIMEOUT_MS,

  DATABASE: {
    URL: _env.DATABASE_URL,
    POOL_MAX: _env.DATABASE_POOL_MAX,
    POOL_IDLE_TIMEOUT: _env.DATABASE_POOL_IDLE_TIMEOUT,
    POOL_CONNECTION_TIMEOUT: _env.DATABASE_POOL_CONNECTION_TIMEOUT,
    QUERY_TIMEOUT: _env.DATABASE_QUERY_TIMEOUT,
  },

  REDIS: {
    HOST: _env.REDIS_HOST,
    PORT: _env.REDIS_PORT,
    PASSWORD: _env.REDIS_PASSWORD,
    DB: _env.REDIS_DB,
    COMMAND_TIMEOUT: _env.REDIS_COMMAND_TIMEOUT,
  },

  PROVIDERS: {
    MESSAGING: {
      ENABLED: _env.MESSAGING_ENABLED === 'true',
      RABBIT_URL: _env.RABBIT_URL,
      RABBIT_USER: _env.RABBIT_USER,
      RABBIT_PASSWORD: _env.RABBIT_PASSWORD,
      PUBLISH_TIMEOUT: _env.RABBITMQ_PUBLISH_TIMEOUT,
    },
  },

  JOBS: {
    HEALTH_CHECK_CRON: _env.HEALTH_CHECK_CRON,
    HEALTH_CHECK_ENABLED: _env.HEALTH_CHECK_ENABLED === 'true',
  },
} as const;

export function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export function envNumber(key: string, fallback: number): number {
  const val = process.env[key];
  return val ? Number(val) : fallback;
}

export function envBool(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (!val) return fallback;
  return val === 'true' || val === '1';
}
