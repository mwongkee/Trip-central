import { describe, it, expect } from 'vitest';
import { edgeSecretOk } from './edge.js';

describe('edgeSecretOk', () => {
  it('allows everything when the guard is not configured', () => {
    expect(edgeSecretOk(undefined, undefined)).toBe(true);
    expect(edgeSecretOk('anything', undefined)).toBe(true);
    expect(edgeSecretOk(undefined, '')).toBe(true);
  });

  it('rejects requests with a missing or wrong secret once configured', () => {
    expect(edgeSecretOk(undefined, 's3cret')).toBe(false);
    expect(edgeSecretOk('', 's3cret')).toBe(false);
    expect(edgeSecretOk('nope', 's3cret')).toBe(false);
    expect(edgeSecretOk('s3cre', 's3cret')).toBe(false); // length mismatch
  });

  it('accepts the matching secret (what CloudFront injects)', () => {
    expect(edgeSecretOk('s3cret', 's3cret')).toBe(true);
  });
});
