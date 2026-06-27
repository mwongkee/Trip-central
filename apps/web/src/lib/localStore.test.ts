import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStore, applyLocalUpdate } from './localStore.js';
import type { DeviceIdentity } from './identity.js';
import type { Item } from '@tripboard/shared';

const matt: DeviceIdentity = { userId: 'user-matt', name: 'Matt', familyId: 'fam-lewis' };

describe('LocalStore (demo backend)', () => {
  let store: LocalStore;
  beforeEach(() => {
    localStorage.clear();
    store = new LocalStore(() => matt);
  });

  it('seeds the trip with families and items', async () => {
    const bundle = await store.getBundle();
    expect(bundle.trip.name).toContain('Nova Scotia');
    expect(bundle.members.length).toBe(6); // 3 families x 2 adults
    expect(bundle.children.length).toBe(8); // 3 + 3 + 2 kids
    expect(bundle.items.length).toBeGreaterThan(5);
  });

  it('a parent voting for self + two kids scores 3', async () => {
    const bundle = await store.getBundle();
    const item = bundle.items.find((i) => !i.isAnchor)!;
    for (const voterId of ['user-matt', 'child-emmett', 'child-nico']) {
      await store.castVote(item.itemId, voterId, 1);
    }
    const detail = await store.getDetail(item.itemId);
    expect(detail.item.voteScore).toBe(3);
    expect(detail.item.voteCount).toBe(3);
    expect(detail.votes.find((v) => v.voterId === 'child-emmett')!.castByUserId).toBe('user-matt');
  });

  it('re-voting the same voter is idempotent; removing reverses', async () => {
    const bundle = await store.getBundle();
    const item = bundle.items[1]!;
    await store.castVote(item.itemId, 'user-matt', 1);
    await store.castVote(item.itemId, 'user-matt', 1);
    let detail = await store.getDetail(item.itemId);
    expect(detail.item.voteCount).toBe(1);
    await store.removeVote(item.itemId, 'user-matt');
    detail = await store.getDetail(item.itemId);
    expect(detail.item.voteScore).toBe(0);
  });

  it('persists across instances (same device)', async () => {
    const bundle = await store.getBundle();
    const item = bundle.items[1]!;
    await store.castVote(item.itemId, 'user-matt', 1);
    const reopened = new LocalStore(() => matt);
    const detail = await reopened.getDetail(item.itemId);
    expect(detail.item.voteScore).toBe(1);
  });

  it('rejects mutations before joining', async () => {
    const anon = new LocalStore(() => null);
    const bundle = await anon.getBundle();
    await expect(anon.castVote(bundle.items[1]!.itemId, 'user-matt', 1)).rejects.toThrow();
  });
});

describe('applyLocalUpdate', () => {
  const meal: Item = {
    entity: 'item', itemId: 'm', tripId: 't', type: 'MEAL', title: 'Lobster', mealType: 'dinner',
    isAnchor: false, status: 'scheduled', scheduledDate: '2026-07-02', slot: 'dinner',
    currency: 'CAD', tags: [], voteScore: 3, voteCount: 3, commentCount: 0,
    createdByUserId: 'u', createdAt: 'x', updatedAt: 'x',
  };
  it('defers a meal back to suggested', () => {
    const out = applyLocalUpdate(meal, { action: 'defer', toMealType: 'dinner' }, 'now');
    expect(out.status).toBe('suggested');
    expect(out.scheduledDate).toBeUndefined();
  });
});
