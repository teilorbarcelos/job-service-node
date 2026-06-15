import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production', 'local']).default('development'),

  PORT: z.coerce.number().default(8888),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().default(30000),
  HOST: z.string().default('0.0.0.0'),
  ENVIRONMENT: z.string().default('local'),
  DEBUG: z.string().default('false'),
  BASE_PATH: z.string().default(''),
  CORS_ORIGINS: z.string().default(''),

  JWT_SECRET: z.string().default('dev-jwt-secret-not-for-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  DATABASE_URL: z.string().default('postgresql://postgres:changeme@localhost:5432/backend_node?schema=public'), // NOSONAR - dev default, sobrescrito via .env em produção
  DATABASE_URL_AUDIT: z.string().default(''),
  DATABASE_POOL_MAX: z.coerce.number().default(20),
  DATABASE_POOL_IDLE_TIMEOUT: z.coerce.number().default(30000),
  DATABASE_POOL_CONNECTION_TIMEOUT: z.coerce.number().default(5000),

  MIGRATE_ONLY: z.enum(['true', 'false']).default('false'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().default(0),

  RATE_LIMIT_ENABLED: z.string().default('true'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_TIME_WINDOW: z.string().default('1 minute'),

  AUTH_MODE: z.enum(['local', 'remote']).default('local'),
  AUTH_PROVIDER: z.enum(['jwt', 'cognito']).default('jwt'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),

  MESSAGING_ENABLED: z.string().default('false'),
  RABBIT_URL: z.string().default('amqp://localhost'),
  RABBIT_USER: z.string().default('guest'),
  RABBIT_PASSWORD: z.string().default('guest'),

  REDIS_COMMAND_TIMEOUT: z.coerce.number().default(5000),
  RABBITMQ_PUBLISH_TIMEOUT: z.coerce.number().default(5000),
  PDF_REQUEST_TIMEOUT: z.coerce.number().default(30000),
  DB_QUERY_TIMEOUT: z.coerce.number().default(10000),

  PDF_SERVICE_URL: z.string().default('http://localhost:8889'),

  AWS_REGION: z.string().default(''),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  USER_POOL_ID: z.string().default(''),
  USER_POOL_REGION: z.string().default(''),
  COGNITO_CLIENT_ID: z.string().default(''),
  S3_PUBLIC_BUCKET: z.string().default(''),
  S3_PRIVATE_BUCKET: z.string().default(''),

  FIRST_USER: z.string().default('admin@email.com'),
  FIRST_PASSWORD: z.string().default(''),

  SMTP_SERVER: z.string().default(''),
  SMTP_USER: z.string().default(''),
  SMTP_USER_PASSWORD: z.string().default(''),
}).refine(
  (data) => {
    if (data.ENVIRONMENT === 'production' && data.JWT_SECRET.length < 32) {
      return false;
    }
    return true;
  },
  {
    message: 'JWT_SECRET deve ter no mínimo 32 caracteres em produção',
    path: ['JWT_SECRET'],
  },
).refine(
  (data) => {
    if (data.MESSAGING_ENABLED === 'true' && !data.RABBIT_URL) {
      return false;
    }
    return true;
  },
  {
    message: 'RABBIT_URL é obrigatório quando MESSAGING_ENABLED=true',
    path: ['RABBIT_URL'],
  },
);

export type EnvSchema = z.infer<typeof envSchema>;

function parseEnv(): EnvSchema {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    if (process.env.NODE_ENV === 'test') {
      throw new Error('Environment validation failed');
    }
    process.exit(1);
  }
  return result.data;
}

const _env = parseEnv();

export const CONFIG = {
  MIGRATE_ONLY: _env.MIGRATE_ONLY === 'true',

  PORT: _env.PORT,
  HOST: _env.HOST,
  LOG_LEVEL: _env.LOG_LEVEL,
  SHUTDOWN_TIMEOUT_MS: _env.SHUTDOWN_TIMEOUT_MS,
  ENVIRONMENT: _env.ENVIRONMENT,
  DEBUG: _env.DEBUG === 'true',
  BASE_PATH: _env.BASE_PATH,
  CORS_ORIGINS: _env.CORS_ORIGINS,

  JWT: {
    SECRET: _env.JWT_SECRET,
    EXPIRES_IN: _env.JWT_EXPIRES_IN,
    REFRESH_EXPIRES_IN: _env.JWT_REFRESH_EXPIRES_IN,
  },
  BCRYPT_ROUNDS: _env.BCRYPT_ROUNDS,

    DATABASE: {
      URL: _env.DATABASE_URL,
      POOL_MAX: _env.DATABASE_POOL_MAX,
      POOL_IDLE_TIMEOUT: _env.DATABASE_POOL_IDLE_TIMEOUT,
      POOL_CONNECTION_TIMEOUT: _env.DATABASE_POOL_CONNECTION_TIMEOUT,
      QUERY_TIMEOUT: _env.DB_QUERY_TIMEOUT,
    },

  REDIS: {
    HOST: _env.REDIS_HOST,
    PORT: _env.REDIS_PORT,
    PASSWORD: _env.REDIS_PASSWORD,
    DB: _env.REDIS_DB,
    COMMAND_TIMEOUT: _env.REDIS_COMMAND_TIMEOUT,
  },

  RATE_LIMIT: {
    ENABLED: _env.RATE_LIMIT_ENABLED === 'true',
    MAX: _env.RATE_LIMIT_MAX,
    TIME_WINDOW: _env.RATE_LIMIT_TIME_WINDOW,
  },

  AUTH_MODE: _env.AUTH_MODE,

  PROVIDERS: {
    AUTH: _env.AUTH_PROVIDER,
    STORAGE: _env.STORAGE_PROVIDER,
    MESSAGING: {
      ENABLED: _env.MESSAGING_ENABLED === 'true',
      RABBIT_URL: _env.RABBIT_URL,
      RABBIT_USER: _env.RABBIT_USER,
      RABBIT_PASSWORD: _env.RABBIT_PASSWORD,
      PUBLISH_TIMEOUT: _env.RABBITMQ_PUBLISH_TIMEOUT,
    },
    PDF: {
      SERVICE_URL: _env.PDF_SERVICE_URL,
      REQUEST_TIMEOUT: _env.PDF_REQUEST_TIMEOUT,
    },
  },

  AWS: {
    REGION: _env.AWS_REGION,
    ACCESS_KEY_ID: _env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: _env.AWS_SECRET_ACCESS_KEY,
    COGNITO: {
      USER_POOL_ID: _env.USER_POOL_ID,
      USER_POOL_REGION: _env.USER_POOL_REGION,
      CLIENT_ID: _env.COGNITO_CLIENT_ID,
    },
    S3: {
      PUBLIC_BUCKET: _env.S3_PUBLIC_BUCKET,
      PRIVATE_BUCKET: _env.S3_PRIVATE_BUCKET,
    },
  },

  FIRST_USER: _env.FIRST_USER,
  FIRST_PASSWORD: _env.FIRST_PASSWORD,

  SMTP: {
    SERVER: _env.SMTP_SERVER,
    USER: _env.SMTP_USER,
    PASSWORD: _env.SMTP_USER_PASSWORD,
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
