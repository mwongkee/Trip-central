import { ulid } from './ulid.js';

/**
 * Device identity. A family member "joins" by typing their name (or picking who
 * they are from the roster); we remember it on this device in localStorage so they
 * don't sign in again. See DECISIONS.md for why this replaces email/password here.
 */

export interface DeviceIdentity {
  userId: string;
  name: string;
  familyId: string;
}

const KEY = 'tripboard.identity';

export function loadIdentity(): DeviceIdentity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceIdentity;
    if (parsed && parsed.userId && parsed.name) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: DeviceIdentity): void {
  localStorage.setItem(KEY, JSON.stringify(identity));
}

export function clearIdentity(): void {
  localStorage.removeItem(KEY);
}

/** A new device user who isn't claiming a seeded member gets a generated id. */
export function newUserId(): string {
  return `user-${ulid().toLowerCase()}`;
}
