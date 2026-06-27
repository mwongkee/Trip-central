/**
 * Tiny time-sortable id for client-created records in local mode. Not a true ULID,
 * but lexically increasing (timestamp prefix) so lists stay roughly in creation order.
 * The server uses a real ULID; ids never need to match across the two.
 */
export function ulid(): string {
  const time = Date.now().toString(36).padStart(9, '0');
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 13)
      : Math.random().toString(36).slice(2, 15);
  return (time + rand).toUpperCase();
}
