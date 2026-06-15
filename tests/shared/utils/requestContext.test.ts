import { describe, it, expect } from 'vitest';
import { runWithContext, getRequestContext, getRequestId } from '@/shared/utils/requestContext.js';

describe('requestContext', () => {
  it('should return undefined outside a context', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('should return empty string for getRequestId outside context', () => {
    expect(getRequestId()).toBe('');
  });

  it('should provide context inside runWithContext', () => {
    runWithContext({ requestId: 'abc-123' }, () => {
      expect(getRequestContext()).toEqual({ requestId: 'abc-123' });
      expect(getRequestId()).toBe('abc-123');
    });
  });

  it('should isolate nested contexts', () => {
    runWithContext({ requestId: 'outer' }, () => {
      expect(getRequestId()).toBe('outer');
      runWithContext({ requestId: 'inner' }, () => {
        expect(getRequestId()).toBe('inner');
      });
      expect(getRequestId()).toBe('outer');
    });
  });
});
