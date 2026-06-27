const PALETTE = [
  '#e8590c', '#2f9e44', '#1971c2', '#9c36b5',
  '#e64980', '#f59f00', '#0c8599', '#5f3dc4',
];

/** Deterministic color for a name so the same person looks consistent everywhere. */
export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

/** One or two initials for an avatar bubble. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? '') : '';
  return (first + last).toUpperCase();
}
