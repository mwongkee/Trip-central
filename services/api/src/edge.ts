import { timingSafeEqual } from 'node:crypto';

/**
 * Verify the CloudFront-injected origin secret. CloudFront adds a fixed
 * `x-edge-secret` header to every `/api/*` request, so traffic that reaches the
 * Lambda *directly* (bypassing CloudFront) lacks it and is rejected.
 *
 * - If `expected` is unset (local dev, tests, or guard disabled), allow — the
 *   check only applies once EDGE_SECRET is configured (i.e. in deployed infra).
 * - Constant-time compare so the secret can't be guessed by timing.
 */
export function edgeSecretOk(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected) return true;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
