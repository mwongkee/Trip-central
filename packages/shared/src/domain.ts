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
