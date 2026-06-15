import { PrismaService } from '../../infra/database/PrismaService.js';
import { redis } from '../../infra/database/RedisProvider.js';
import { messagingProvider } from '../../infra/messaging/RabbitMQProvider.js';
import { CONFIG } from '../config/env.js';
import { businessMetrics } from './metrics.js';

export type HealthCheckResult = Record<string, boolean | string>;

async function checkPostgresql(): Promise<{ ok: boolean; status: boolean | string }> {
  try {
    if (!PrismaService.mainPool) {
      return { ok: false, status: 'not_initialized' };
    }
    const client = await PrismaService.mainPool.connect();
    await client.query('SELECT 1');
    client.release();
    return { ok: true, status: true };
  } catch {
    return { ok: false, status: false };
  }
}

async function checkRedis(): Promise<{ ok: boolean; status: boolean | string }> {
  try {
    await redis.ping();
    return { ok: true, status: true };
  } catch {
    return { ok: false, status: false };
  }
}

async function checkMessaging(): Promise<{ ok: boolean; status: boolean | string }> {
  if (!CONFIG.PROVIDERS.MESSAGING.ENABLED) {
    return { ok: true, status: 'disabled' };
  }
  try {
    const healthy = await messagingProvider.check();
    return { ok: healthy, status: healthy };
  } catch {
    return { ok: false, status: false };
  }
}

async function checkPdfService(): Promise<{ ok: boolean; status: boolean | string }> {
  try {
    const response = await fetch(`${CONFIG.PROVIDERS.PDF.SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const ok = response.ok;
    return { ok, status: ok };
  } catch {
    return { ok: false, status: false };
  }
}

export async function checkReadiness(): Promise<{
  status: string;
  checks: HealthCheckResult;
}> {
  const checks: HealthCheckResult = {};
  let allHealthy = true;

  const pg = await checkPostgresql();
  checks.postgresql = pg.status;
  if (!pg.ok) allHealthy = false;
  businessMetrics.healthCheckGauge.labels('postgresql').set(pg.ok ? 1 : 0);

  const redisResult = await checkRedis();
  checks.redis = redisResult.status;
  if (!redisResult.ok) allHealthy = false;
  businessMetrics.healthCheckGauge.labels('redis').set(redisResult.ok ? 1 : 0);

  const mq = await checkMessaging();
  checks.rabbitmq = mq.status;
  if (!mq.ok) allHealthy = false;
  const mqHealthy = mq.status === true;
  businessMetrics.healthCheckGauge.labels('rabbitmq').set(mqHealthy ? 1 : 0);

  const pdf = await checkPdfService();
  checks.pdfService = pdf.status;
  if (!pdf.ok) allHealthy = false;
  businessMetrics.healthCheckGauge.labels('pdf').set(pdf.ok ? 1 : 0);

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
  };
}
