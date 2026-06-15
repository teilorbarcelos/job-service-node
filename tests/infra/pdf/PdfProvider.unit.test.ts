import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfProvider } from '@/infra/pdf/PdfProvider.js';
import { runWithContext } from '@/shared/utils/requestContext.js';

describe('PdfProvider Unit Test', () => {
  let provider: PdfProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PdfProvider();
  });

  it('should call the remote service and return a stream', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: mockStream,
    } as Response);

    const request = {
      template: 'test',
      data: { name: 'John' },
    };

    const result = await provider.generatePdf(request);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/pdf/generate'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
    );
    expect(result).toBe(mockStream);
  });

  it('should fallback to mock PDF when response is not ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
    } as Response);

    const request = { template: 'test', data: {} };
    const result = await provider.generatePdf(request);

    expect(result).toBeInstanceOf(ReadableStream);
    const reader = result.getReader();
    let chunks = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks += decoder.decode(value);
    }
    expect(chunks).toContain('Mock PDF Content');
  });

  it('should fallback to mock PDF when response body is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: null,
    } as unknown as Response);

    const request = { template: 'test', data: {} };
    const result = await provider.generatePdf(request);

    expect(result).toBeInstanceOf(ReadableStream);
    const reader = result.getReader();
    let chunks = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks += decoder.decode(value);
    }
    expect(chunks).toContain('Mock PDF Content');
  });

  it('should fallback to mock PDF when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection failed'));

    const request = { template: 'test', data: {} };
    const result = await provider.generatePdf(request);
    expect(result).toBeInstanceOf(ReadableStream);

    const reader = result.getReader();
    let chunks = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks += decoder.decode(value);
    }
    expect(chunks).toContain('Mock PDF Content');
  });

  it('should propagate X-Request-Id header when context has requestId', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) { controller.close(); },
      }),
    } as Response);

    await runWithContext({ requestId: 'req-456' }, async () => {
      await provider.generatePdf({ template: 'test', data: {} });
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/pdf/generate'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Request-Id': 'req-456' }),
      })
    );
  });
});
