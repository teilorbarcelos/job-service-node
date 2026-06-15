import { CONFIG } from '../../shared/config/env.js';
import { logger } from '../../shared/utils/logger.js';
import { withRetry, createCircuitBreaker } from '../../shared/utils/resilience.js';
import { getRequestId } from '../../shared/utils/requestContext.js';
import { createTimeoutSignal } from '../../shared/utils/signals.js';

export interface PdfRequestDTO {
  template: string;
  data: Record<string, unknown>;
  options?: {
    landscape?: boolean;
    format?: string;
  };
}

export interface IPdfProvider {
  generatePdf(request: PdfRequestDTO): Promise<ReadableStream<Uint8Array>>;
}

function createMockPdfStream(): ReadableStream<Uint8Array> {
  const mockPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 51 >>
stream
BT
/F1 12 Tf
72 712 Td
(Mock PDF Content) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000212 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
311
%%EOF`;

  const encoder = new TextEncoder();
  const uint8array = encoder.encode(mockPdf);

  return new ReadableStream({
    start(controller) {
      controller.enqueue(uint8array);
      controller.close();
    }
  });
}

export class PdfProvider implements IPdfProvider {
  private readonly serviceUrl: string;
  private readonly requestTimeout: number;
  private pdfFetch!: { fire: (...args: unknown[]) => Promise<Response> };

  constructor() {
    this.serviceUrl = CONFIG.PROVIDERS.PDF.SERVICE_URL;
    this.requestTimeout = CONFIG.PROVIDERS.PDF.REQUEST_TIMEOUT;

    this.pdfFetch = createCircuitBreaker(
      this.fetchWithRetry.bind(this) as (...args: unknown[]) => Promise<Response>,
      { name: 'pdf-service', timeout: Math.max(this.requestTimeout + 5000, 20000) },
    );
  }

  private async fetchWithRetry(url: string, body: string): Promise<Response> {
    return withRetry(async () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const requestId = getRequestId();
      if (requestId) {
        headers['X-Request-Id'] = requestId;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: createTimeoutSignal(this.requestTimeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate PDF: ${response.statusText}`);
      }
      if (!response.body) {
        throw new Error('Response body is empty');
      }
      return response;
    });
  }

  async generatePdf(request: PdfRequestDTO): Promise<ReadableStream<Uint8Array>> {
    try {
      const response = await this.pdfFetch.fire(
        `${this.serviceUrl}/v1/pdf/generate`,
        JSON.stringify(request),
      );
      return response.body!;
    } catch (err) {
      logger.error({ err }, '[PdfProvider] Error');
      logger.warn('[PdfProvider] PDF Service unavailable. Using fallback mock PDF.');
      return createMockPdfStream();
    }
  }
}

export const pdfProvider = new PdfProvider();
