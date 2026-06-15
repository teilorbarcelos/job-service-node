import { describe, it, expect, beforeEach } from 'vitest';
import { {{Name}}Job } from '@/jobs/{{Name}}Job.js';

describe('{{Name}}Job', () => {
  let job: {{Name}}Job;

  beforeEach(() => {
    job = new {{Name}}Job();
  });

  it('deve expor name, schedule e description corretos', () => {
    expect(job.name).toBe('{{name}}');
    expect(job.schedule).toBe('{{schedule}}');
    expect(job.description).toBe('{{description}}');
  });

  it('deve estar habilitado por padrão', () => {
    expect(job.enabled).toBe(true);
  });

  it('deve permitir desabilitar via enabled=false', () => {
    job.enabled = false;
    expect(job.enabled).toBe(false);
  });

  it('deve executar run() com success quando habilitado', async () => {
    const result = await job.run(new AbortController().signal);
    expect(result.status).toBe('success');
    expect(result.job).toBe('{{name}}');
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('deve retornar skipped quando desabilitado', async () => {
    job.enabled = false;
    const result = await job.run(new AbortController().signal);
    expect(result.status).toBe('skipped');
    expect(result.duration_ms).toBe(0);
  });
});
