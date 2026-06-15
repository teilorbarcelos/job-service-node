import { Counter, Gauge, register } from 'prom-client';

export function getOrCreateCounter(config: { name: string; help: string; labelNames: string[] }): Counter<string> {
  const existing = register.getSingleMetric(config.name);
  if (existing) return existing as Counter<string>;
  return new Counter(config);
}

export function getOrCreateGauge(config: { name: string; help: string; labelNames: string[] }): Gauge<string> {
  const existing = register.getSingleMetric(config.name);
  if (existing) return existing as Gauge<string>;
  return new Gauge(config);
}

export const businessMetrics = {
  loginsTotal: getOrCreateCounter({
    name: 'business_logins_total',
    help: 'Total login attempts',
    labelNames: ['status'],
  }),

  exportsTotal: getOrCreateCounter({
    name: 'business_exports_total',
    help: 'Total file exports',
    labelNames: ['type'],
  }),

  messagesPublished: getOrCreateCounter({
    name: 'business_messages_published_total',
    help: 'Total messages published to RabbitMQ',
    labelNames: ['queue'],
  }),

  messagesConsumed: getOrCreateCounter({
    name: 'business_messages_consumed_total',
    help: 'Total messages consumed from RabbitMQ',
    labelNames: ['queue'],
  }),

  auditDropsTotal: getOrCreateCounter({
    name: 'business_audit_drops_total',
    help: 'Total audit entries dropped due to buffer overflow',
    labelNames: [],
  }),

  healthCheckGauge: getOrCreateGauge({
    name: 'business_health_check',
    help: 'Health check per service (1 = healthy, 0 = unhealthy)',
    labelNames: ['service'],
  }),
};
