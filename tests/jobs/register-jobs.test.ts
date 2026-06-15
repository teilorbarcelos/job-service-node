import { describe, it, expect, vi } from 'vitest';
import { registerJobs } from '@/jobs/register-jobs.js';
import { Scheduler } from '@/core/Scheduler.js';

vi.mock('@/jobs/HealthCheckJob.js', () => ({
  HealthCheckJob: vi.fn().mockImplementation(function MockHealthCheckJob() {
    return {
      name: 'health-check',
      schedule: '*/1 * * * *',
      description: 'mocked',
      enabled: true,
      run: vi.fn().mockResolvedValue({ job: 'health-check', status: 'success', duration_ms: 0 }),
    };
  }),
}));

vi.mock('@/infra/health/DefaultHealthChecker.js', () => ({
  DefaultHealthChecker: vi.fn().mockImplementation(function MockChecker() {
    return {};
  }),
}));

describe('registerJobs', () => {
  it('deve retornar um Scheduler configurado', () => {
    const scheduler = registerJobs();
    expect(scheduler).toBeInstanceOf(Scheduler);
  });

  it('deve registrar pelo menos o health-check', () => {
    const scheduler = registerJobs();
    const jobs = scheduler.listJobs();
    expect(jobs.map(j => j.name)).toContain('health-check');
  });
});
