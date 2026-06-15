import { describe, it, expect, vi } from 'vitest';
import { env, envNumber, envBool, CONFIG, envSchema } from '@/shared/config/env.js';

describe('Environment Config Helpers', () => {
  it('env() should return value or fallback', () => {
    vi.stubEnv('TEST_KEY', 'test_value');
    expect(env('TEST_KEY')).toBe('test_value');
    expect(env('NON_EXISTENT', 'default')).toBe('default');
    vi.unstubAllEnvs();
  });

  it('envNumber() should return number or fallback', () => {
    vi.stubEnv('TEST_NUM', '123');
    expect(envNumber('TEST_NUM', 0)).toBe(123);

    vi.stubEnv('TEST_NUM_EMPTY', '');
    expect(envNumber('TEST_NUM_EMPTY', 456)).toBe(456);

    vi.unstubAllEnvs();
  });

  it('envBool() should return boolean correctly', () => {
    vi.stubEnv('B1', 'true');
    vi.stubEnv('B2', '1');
    vi.stubEnv('B3', 'false');
    vi.stubEnv('B4', '');

    expect(envBool('B1')).toBe(true);
    expect(envBool('B2')).toBe(true);
    expect(envBool('B3')).toBe(false);
    expect(envBool('B4', true)).toBe(true);
    expect(envBool('B5', false)).toBe(false);

    vi.unstubAllEnvs();
  });
});

describe('CONFIG Object', () => {
  it('should have basic properties defined', () => {
    expect(CONFIG.PORT).toBeDefined();
    expect(CONFIG.ENVIRONMENT).toBeDefined();
    expect(CONFIG.JWT.SECRET).toBeDefined();
  });

  it('should have expected structure', () => {
    expect(typeof CONFIG.PORT).toBe('number');
    expect(typeof CONFIG.HOST).toBe('string');
    expect(typeof CONFIG.JWT.SECRET).toBe('string');
    expect(typeof CONFIG.PROVIDERS.MESSAGING.ENABLED).toBe('boolean');
    expect(typeof CONFIG.RATE_LIMIT.MAX).toBe('number');
    expect(typeof CONFIG.RATE_LIMIT.TIME_WINDOW).toBe('string');
  });
});

describe('envSchema Validation', () => {
  const validEnv = {
    JWT_SECRET: 'this-is-a-long-enough-secret-key-for-testing',
    DATABASE_URL: 'postgresql://localhost:5432/test',
  };

  it('should accept valid environment', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('should reject short JWT_SECRET in production', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      ENVIRONMENT: 'production',
      JWT_SECRET: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('JWT_SECRET'))).toBe(true);
    }
  });

  it('should accept short JWT_SECRET in non-production', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      ENVIRONMENT: 'development',
      JWT_SECRET: 'short',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing RABBIT_URL when MESSAGING_ENABLED', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      MESSAGING_ENABLED: 'true',
      RABBIT_URL: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(i => i.path.includes('RABBIT_URL'))).toBe(true);
    }
  });

  it('should accept MESSAGING_ENABLED without RABBIT_URL if disabled', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      MESSAGING_ENABLED: 'false',
      RABBIT_URL: '',
    });
    expect(result.success).toBe(true);
  });

  it('should coerce PORT to number', () => {
    const result = envSchema.safeParse({ ...validEnv, PORT: '4000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(4000);
    }
  });

  it('should apply defaults for optional fields', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(8888);
      expect(result.data.HOST).toBe('0.0.0.0');
      expect(result.data.RATE_LIMIT_MAX).toBe(100);
      expect(result.data.AUTH_PROVIDER).toBe('jwt');
    }
  });

  it('should reject invalid AUTH_PROVIDER', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      AUTH_PROVIDER: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid NODE_ENV', () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NODE_ENV: 'staging',
    });
    expect(result.success).toBe(false);
  });
});
