import { describe, it, expect } from 'vitest';
import { getOrCreateCounter, getOrCreateGauge, businessMetrics } from '@/shared/utils/metrics.js';

describe('businessMetrics', () => {
  it('should have all metric definitions', () => {
    expect(businessMetrics.loginsTotal).toBeDefined();
    expect(businessMetrics.exportsTotal).toBeDefined();
    expect(businessMetrics.messagesPublished).toBeDefined();
    expect(businessMetrics.messagesConsumed).toBeDefined();
    expect(businessMetrics.auditDropsTotal).toBeDefined();
    expect(businessMetrics.healthCheckGauge).toBeDefined();
  });

  it('should increment login total', () => {
    expect(() => businessMetrics.loginsTotal.labels('success').inc()).not.toThrow();
  });

  it('should increment export total', () => {
    expect(() => businessMetrics.exportsTotal.labels('pdf').inc()).not.toThrow();
  });

  it('should increment message counters', () => {
    expect(() => {
      businessMetrics.messagesPublished.labels('test-queue').inc();
      businessMetrics.messagesConsumed.labels('test-queue').inc();
    }).not.toThrow();
  });

  it('should increment audit drops', () => {
    expect(() => businessMetrics.auditDropsTotal.inc()).not.toThrow();
  });

  it('should set health check gauge', () => {
    expect(() => businessMetrics.healthCheckGauge.labels('postgresql').set(1)).not.toThrow();
  });

  it('should reuse existing counter via getOrCreateCounter', () => {
    const counter = getOrCreateCounter({ name: 'business_logins_total', help: '', labelNames: ['status'] });
    expect(counter).toBe(businessMetrics.loginsTotal);
  });

  it('should reuse existing gauge via getOrCreateGauge', () => {
    const gauge = getOrCreateGauge({ name: 'business_health_check', help: '', labelNames: ['service'] });
    expect(gauge).toBe(businessMetrics.healthCheckGauge);
  });

  it('should create new counter if not exists', () => {
    const counter = getOrCreateCounter({ name: 'test_new_counter', help: 'test', labelNames: ['l'] });
    expect(counter).toBeDefined();
  });

  it('should create new gauge if not exists', () => {
    const gauge = getOrCreateGauge({ name: 'test_new_gauge', help: 'test', labelNames: ['l'] });
    expect(gauge).toBeDefined();
  });
});
