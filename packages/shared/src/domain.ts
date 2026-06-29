import type { Expense, Item, Member, ChildProfile, Vote } from './schemas.js';

/**
 * Pure domain math — shared by web and api, unit-tested in isolation.
 */

/** Width of the zero-padded score used in GSI2SK so ascending sort = highest first. */
export const SCORE_PAD_BASE = 9999;

/**
 * GSI2 sort key score pad. Higher voteScore sorts first under an ascending query.
 * Clamped so it never goes negative or overflows the 4-digit pad.
 */
export function scorePad(voteScore: number): string {
  const v = Math.max(0, Math.min(SCORE_PAD_BASE, SCORE_PAD_BASE - voteScore));
  return v.toString().padStart(4, '0');
}

/** A votable identity: an adult member or a child profile. */
export interface Voter {
  voterId: string;
  name: string;
  type: 'adult' | 'child';
  familyId: string;
  familyName: string;
}

/** Flatten members + children into the full list of votable identities. */
export function allVoters(members: Member[], children: ChildProfile[]): Voter[] {
  const m: Voter[] = members.map((x) => ({
    voterId: x.userId,
    name: x.name,
    type: 'adult',
    familyId: x.familyId,
    familyName: x.familyName,
  }));
  const c: Voter[] = children.map((x) => ({
    voterId: x.childId,
    name: x.name,
    type: 'child',
    familyId: x.familyId,
    familyName: x.familyName,
  }));
  return [...m, ...c];
}

/** Everyone in the voter's household — used by the "mark your family" vote control. */
export function familyVoters(
  familyId: string,
  members: Member[],
  children: ChildProfile[],
): Voter[] {
  return allVoters(members, children).filter((v) => v.familyId === familyId);
}

/** Great-circle distance in km between two lat/lng points (haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type TravelMode = 'walk' | 'drive';

/**
 * Estimated travel time (minutes) between two points. We don't have a routing
 * engine, so this approximates road distance as straight-line × 1.3 and divides
 * by a typical speed. Driving speed scales with distance — short trips are city
 * speed, longer trips approach highway speed — so a day-trip doesn't read like a
 * crawl at one flat city speed. Still approximate; label it as such in the UI.
 */
export function travelMinutes(lat1: number, lng1: number, lat2: number, lng2: number, mode: TravelMode): number {
  const roadKm = haversineKm(lat1, lng1, lat2, lng2) * 1.3;
  let kmh: number;
  if (mode === 'walk') kmh = 4.8;
  else if (roadKm <= 5) kmh = 30; // dense city, lights
  else if (roadKm <= 20) kmh = 55; // urban arterials / suburbs
  else kmh = 72; // highway-dominated longer drives
  return (roadKm / kmh) * 60;
}

/** Net score and count derived from a list of votes (server keeps a denormalized copy). */
export function tallyVotes(votes: Vote[]): { voteScore: number; voteCount: number } {
  return {
    voteScore: votes.reduce((s, v) => s + v.value, 0),
    voteCount: votes.length,
  };
}

/** Group items into the day → slot itinerary structure for a date range. */
export function buildItinerary(
  items: Item[],
  from: string,
  to: string,
): { date: string; slots: { slot: string; items: Item[] }[] }[] {
  const scheduled = items
    .filter((i) => i.status === 'scheduled' && i.scheduledDate)
    .filter((i) => i.scheduledDate! >= from && i.scheduledDate! <= to);

  const byDate = new Map<string, Map<string, Item[]>>();
  for (const item of scheduled) {
    const date = item.scheduledDate!;
    const slot = item.slot ?? 'unscheduled';
    if (!byDate.has(date)) byDate.set(date, new Map());
    const slots = byDate.get(date)!;
    if (!slots.has(slot)) slots.set(slot, []);
    slots.get(slot)!.push(item);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({
      date,
      slots: [...slots.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([slot, slotItems]) => ({ slot, items: slotItems })),
    }));
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number; // minor units
}

/**
 * Client-side settle-up: minimize transfers needed so everyone's net is zero.
 * Each expense is split evenly across `splitAmong`; the payer fronted the whole amount.
 * Returns the list of "who owes whom" transfers (greedy, good enough at family scale).
 */
export function settleUp(expenses: Expense[]): Settlement[] {
  const net = new Map<string, number>(); // userId -> net (positive = owed money)

  for (const e of expenses) {
    const n = e.splitAmong.length;
    if (n === 0) continue;
    const share = Math.floor(e.amount / n);
    let remainder = e.amount - share * n; // distribute rounding pennies deterministically
    for (const u of e.splitAmong) {
      let owed = share;
      if (remainder > 0) {
        owed += 1;
        remainder -= 1;
      }
      net.set(u, (net.get(u) ?? 0) - owed);
    }
    net.set(e.paidByUserId, (net.get(e.paidByUserId) ?? 0) + e.amount);
  }

  const creditors = [...net.entries()]
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v);
  const debtors = [...net.entries()]
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }))
    .sort((a, b) => b.v - a.v);

  const settlements: Settlement[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci]!;
    const d = debtors[di]!;
    const amount = Math.min(c.v, d.v);
    if (amount > 0) {
      settlements.push({ fromUserId: d.id, toUserId: c.id, amount });
    }
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) ci += 1;
    if (d.v === 0) di += 1;
  }
  return settlements;
}

/** Totals by expense category (minor units). */
export function totalsByCategory(expenses: Expense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    out[e.category] = (out[e.category] ?? 0) + e.amount;
  }
  return out;
}

/**
 * Extract `{ lat, lng }` from a Google/Apple Maps URL or a bare "lat, lng" string.
 * Handles the full-URL forms (@lat,lng · !3d..!4d.. · ?q=/ll=/destination=lat,lng).
 * Returns null for short share links (maps.app.goo.gl) — those carry no coordinates
 * and must be redirect-resolved server-side first. Pure + shared by web and api.
 */
export function coordsFromMapUrl(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const valid = (lat: number, lng: number): boolean =>
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const pats = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // /place/.../@44.64,-63.56,17z
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // data=...!3d44.64!4d-63.56
    /[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i,
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // bare "44.64, -63.56"
  ];
  for (const p of pats) {
    const m = input.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/** A Google/Apple Maps short share link whose target must be resolved server-side. */
export function isShortMapLink(input: string): boolean {
  return /\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.apple\.com)\b/i.test(input.trim());
}
