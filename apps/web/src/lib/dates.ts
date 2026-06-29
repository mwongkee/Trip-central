/** Small date helpers for the trip planner (display + trip-day enumeration). */

/** "Tue Jul 1" — full day chip / label. */
export function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Jul 1" — compact day for badges. */
export function shortDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const SHORT_SLOT: Record<string, string> = {
  morning: 'AM', afternoon: 'PM', evening: 'Eve',
  breakfast: 'Brk', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};
/** "AM" / "Lunch" — compact slot label. */
export function shortSlot(slot?: string): string {
  return slot ? (SHORT_SLOT[slot] ?? slot) : '';
}

/** Today as yyyy-mm-dd in the device's LOCAL timezone (not UTC — avoids off-by-one). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Inclusive list of yyyy-mm-dd between start and end (UTC math, DST-safe). Empty if unset. */
export function tripDays(start?: string, end?: string): string[] {
  const s = start ?? end;
  const e = end ?? start;
  if (!s || !e) return [];
  let t = Date.parse(`${s}T00:00:00Z`);
  const last = Date.parse(`${e}T00:00:00Z`);
  if (Number.isNaN(t) || Number.isNaN(last) || last < t) return [];
  const out: string[] = [];
  let guard = 0;
  while (t <= last && guard < 60) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
    guard += 1;
  }
  return out;
}
