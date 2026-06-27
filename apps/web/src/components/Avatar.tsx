import { colorForName, initials } from '../lib/avatar.js';

/** Small colored initials bubble. Decorative — names are always shown as text too. */
export function Avatar({ name, color, size = 22 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        background: color ?? colorForName(name),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initials(name)}
    </span>
  );
}
