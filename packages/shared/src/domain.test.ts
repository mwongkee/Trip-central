import { describe, it, expect } from 'vitest';
import {
  scorePad,
  settleUp,
  tallyVotes,
  totalsByCategory,
  buildItinerary,
  familyVoters,
  haversineKm,
} from './domain.js';
import type { Expense, Item, Member, ChildProfile, Vote } from './schemas.js';

const member = (userId: string, familyId: string): Member => ({
  entity: 'member',
  tripId: 't',
  userId,
  name: userId,
  role: 'editor',
  familyId,
  familyName: familyId,
  joinedAt: '2026-01-01T00:00:00Z',
});

const child = (childId: string, familyId: string): ChildProfile => ({
  entity: 'child',
  tripId: 't',
  childId,
  name: childId,
  ownerUserId: 'owner',
  familyId,
  familyName: familyId,
  avatarColor: '#fff',
});

const expense = (over: Partial<Expense>): Expense => ({
  entity: 'expense',
  expenseId: 'e',
  tripId: 't',
  amount: 0,
  currency: 'CAD',
  category: 'other',
  paidByUserId: 'a',
  date: '2026-07-01',
  splitAmong: ['a'],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('scorePad', () => {
  it('sorts higher scores first under ascending order', () => {
    expect(scorePad(0)).toBe('9999');
    expect(scorePad(5)).toBe('9994');
    expect(scorePad(10) < scorePad(3)).toBe(true);
  });
  it('clamps out-of-range scores', () => {
    expect(scorePad(-100)).toBe('9999');
    expect(scorePad(100000)).toBe('0000');
  });
});

describe('haversineKm', () => {
  it('is ~0 for the same point', () => {
    expect(haversineKm(44.65, -63.57, 44.65, -63.57)).toBeCloseTo(0, 5);
  });
  it('measures Halifax waterfront → Peggys Cove at roughly 33 km', () => {
    const d = haversineKm(44.6476, -63.5683, 44.4915, -63.917);
    expect(d).toBeGreaterThan(28);
    expect(d).toBeLessThan(38);
  });
  it('is symmetric', () => {
    const a = haversineKm(44.64, -63.57, 44.67, -63.57);
    const b = haversineKm(44.67, -63.57, 44.64, -63.57);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('tallyVotes', () => {
  it('nets the values and counts', () => {
    const votes: Vote[] = [
      { entity: 'vote', itemId: 'i', voterId: 'a', voterType: 'adult', voterName: 'a', value: 1, castByUserId: 'a', createdAt: 'x' },
      { entity: 'vote', itemId: 'i', voterId: 'b', voterType: 'child', voterName: 'b', value: 1, castByUserId: 'a', createdAt: 'x' },
      { entity: 'vote', itemId: 'i', voterId: 'c', voterType: 'adult', voterName: 'c', value: -1, castByUserId: 'c', createdAt: 'x' },
    ];
    expect(tallyVotes(votes)).toEqual({ voteScore: 1, voteCount: 3 });
  });
});

describe('familyVoters', () => {
  it('returns only the household: self, spouse, and kids', () => {
    const members = [member('lewis', 'fam-lewis'), member('kristin', 'fam-lewis'), member('steve', 'fam-steve')];
    const children = [child('emmett', 'fam-lewis'), child('nico', 'fam-lewis'), child('isaac', 'fam-steve')];
    const fam = familyVoters('fam-lewis', members, children).map((v) => v.voterId).sort();
    expect(fam).toEqual(['emmett', 'kristin', 'lewis', 'nico']);
  });
});

describe('settleUp', () => {
  it('returns no transfers when everyone paid their share', () => {
    expect(settleUp([expense({ amount: 1000, paidByUserId: 'a', splitAmong: ['a'] })])).toEqual([]);
  });
  it('computes who owes whom across multiple payers', () => {
    // a pays 3000 split a,b,c (each owes 1000); net a=+2000, b=-1000, c=-1000
    const s = settleUp([expense({ amount: 3000, paidByUserId: 'a', splitAmong: ['a', 'b', 'c'] })]);
    const total = s.reduce((sum, x) => sum + x.amount, 0);
    expect(total).toBe(2000);
    expect(s.every((x) => x.toUserId === 'a')).toBe(true);
  });
  it('conserves money (sum of transfers nets to zero)', () => {
    const s = settleUp([
      expense({ amount: 6000, paidByUserId: 'a', splitAmong: ['a', 'b', 'c'] }),
      expense({ amount: 3000, paidByUserId: 'b', splitAmong: ['a', 'b', 'c'] }),
    ]);
    const net = new Map<string, number>();
    for (const t of s) {
      net.set(t.fromUserId, (net.get(t.fromUserId) ?? 0) - t.amount);
      net.set(t.toUserId, (net.get(t.toUserId) ?? 0) + t.amount);
    }
    expect([...net.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('totalsByCategory', () => {
  it('sums per category', () => {
    const out = totalsByCategory([
      expense({ amount: 1000, category: 'dining' }),
      expense({ amount: 500, category: 'dining' }),
      expense({ amount: 2000, category: 'lodging' }),
    ]);
    expect(out).toEqual({ dining: 1500, lodging: 2000 });
  });
});

describe('buildItinerary', () => {
  const item = (over: Partial<Item>): Item => ({
    entity: 'item',
    itemId: Math.random().toString(),
    tripId: 't',
    type: 'PLACE',
    title: 'x',
    isAnchor: false,
    status: 'scheduled',
    currency: 'CAD',
    tags: [],
    voteScore: 0,
    voteCount: 0,
    commentCount: 0,
    createdByUserId: 'a',
    createdAt: 'x',
    updatedAt: 'x',
    ...over,
  });
  it('groups scheduled items by date then slot within a window', () => {
    const out = buildItinerary(
      [
        item({ scheduledDate: '2026-07-02', slot: 'morning' }),
        item({ scheduledDate: '2026-07-02', slot: 'dinner' }),
        item({ scheduledDate: '2026-07-01', slot: 'afternoon' }),
        item({ scheduledDate: '2026-07-09', slot: 'morning' }), // outside window
        item({ status: 'suggested', scheduledDate: '2026-07-02', slot: 'morning' }), // not scheduled
      ],
      '2026-07-01',
      '2026-07-03',
    );
    expect(out.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02']);
    expect(out[1]!.slots.map((s) => s.slot)).toEqual(['dinner', 'morning']);
  });
});
