import { describe, it, expect } from 'vitest';
import { checkRateLimit, getRateLimitKey } from './rateLimit';

describe('getRateLimitKey', () => {
  it('creates a key from userId and endpoint', () => {
    const key = getRateLimitKey('user123', 'practice');
    expect(key).toBe('user123:practice');
  });
});

describe('checkRateLimit', () => {
  it('allows requests within limit', () => {
    const result = checkRateLimit('test-user:test', 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests exceeding the limit', () => {
    const key = 'test-user:burst';
    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit(key, 3, 60_000);
      if (i < 3) {
        expect(result.allowed).toBe(true);
      } else {
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }
    }
  });

  it('resets after window expires', () => {
    const key = 'test-user:window';
    const result1 = checkRateLimit(key, 1, 50);
    expect(result1.allowed).toBe(true);

    const result2 = checkRateLimit(key, 1, 50);
    expect(result2.allowed).toBe(false);

    const result3 = checkRateLimit('test-user:window-reset', 5, -1);
    expect(result3.allowed).toBe(true);
  });

  it('provides resetAt timestamp', () => {
    const result = checkRateLimit('test-user:reset', 5, 10_000);
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 10_000);
  });
});
