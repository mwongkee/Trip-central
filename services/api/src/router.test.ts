import { describe, it, expect, beforeEach } from 'vitest';
import { handleRequest, applyItemUpdate, type ApiRequest, type Identity } from './router.js';
import { MemoryRepo } from './memory-repo.js';
import type { Item, Member, ChildProfile } from '@tripboard/shared';

const TRIP = 't1';
const lewis: Identity = { userId: 'user-lewis', name: 'Lewis' };

function makeRepo(): MemoryRepo {
  const repo = new MemoryRepo();
  repo.seedTrip({
    entity: 'trip',
    tripId: TRIP,
    name: 'Nova Scotia',
    baseCurrency: 'CAD',
    timezone: 'America/Halifax',
    inviteCode: 'ABC',
    createdAt: 'x',
    updatedAt: 'x',
  });
  const members: Member[] = [
    { entity: 'member', tripId: TRIP, userId: 'user-lewis', name: 'Lewis', role: 'owner', familyId: 'fam-lewis', familyName: 'Lewis & Kristin', joinedAt: 'x' },
    { entity: 'member', tripId: TRIP, userId: 'user-kristin', name: 'Kristin', role: 'editor', familyId: 'fam-lewis', familyName: 'Lewis & Kristin', joinedAt: 'x' },
  ];
  const kids: ChildProfile[] = [
    { entity: 'child', tripId: TRIP, childId: 'child-emmett', name: 'Emmett', ownerUserId: 'user-lewis', familyId: 'fam-lewis', familyName: 'Lewis & Kristin', avatarColor: '#f00' },
    { entity: 'child', tripId: TRIP, childId: 'child-nico', name: 'Nico', ownerUserId: 'user-lewis', familyId: 'fam-lewis', familyName: 'Lewis & Kristin', avatarColor: '#0f0' },
  ];
  for (const m of members) void repo.upsertMember(m);
  for (const k of kids) void repo.putChild(k);
  return repo;
}

const req = (over: Partial<ApiRequest>): ApiRequest => ({
  method: 'GET',
  path: '/',
  query: {},
  body: undefined,
  identity: null,
  ...over,
});

describe('routing basics', () => {
  it('health is open', async () => {
    const res = await handleRequest(makeRepo(), req({ path: '/health' }));
    expect(res).toEqual({ statusCode: 200, body: { ok: true } });
  });

  it('mutations require an identity', async () => {
    const res = await handleRequest(
      makeRepo(),
      req({ method: 'POST', path: `/trips/${TRIP}/items`, body: { type: 'PLACE', title: 'x' } }),
    );
    expect(res.statusCode).toBe(401);
  });

  it('rejects unknown trips', async () => {
    const res = await handleRequest(makeRepo(), req({ path: '/trips/nope' }));
    expect(res.statusCode).toBe(404);
  });
});

describe('items + family voting (M2)', () => {
  let repo: MemoryRepo;
  beforeEach(() => {
    repo = makeRepo();
  });

  async function createPlace(): Promise<Item> {
    const res = await handleRequest(
      repo,
      req({
        method: 'POST',
        path: `/trips/${TRIP}/items`,
        identity: lewis,
        body: { type: 'PLACE', title: 'Peggys Cove', category: 'viewpoint' },
      }),
    );
    expect(res.statusCode).toBe(201);
    return res.body as Item;
  }

  it('a parent casts votes for self and two kids → score reflects 3', async () => {
    const item = await createPlace();
    for (const voterId of ['user-lewis', 'child-emmett', 'child-nico']) {
      const res = await handleRequest(
        repo,
        req({ method: 'POST', path: `/trips/${TRIP}/items/${item.itemId}/votes`, identity: lewis, body: { voterId, value: 1 } }),
      );
      expect(res.statusCode).toBe(200);
    }
    const detail = await repo.getItemDetail(TRIP, item.itemId);
    expect(detail!.item.voteScore).toBe(3);
    expect(detail!.item.voteCount).toBe(3);
    expect(detail!.votes.find((v) => v.voterId === 'child-emmett')!.castByUserId).toBe('user-lewis');
  });

  it('re-voting the same voter is idempotent on the count', async () => {
    const item = await createPlace();
    const cast = (value: number) =>
      handleRequest(repo, req({ method: 'POST', path: `/trips/${TRIP}/items/${item.itemId}/votes`, identity: lewis, body: { voterId: 'user-lewis', value } }));
    await cast(1);
    await cast(1);
    const detail = await repo.getItemDetail(TRIP, item.itemId);
    expect(detail!.item.voteCount).toBe(1);
    expect(detail!.item.voteScore).toBe(1);
  });

  it('rejects voting for someone outside the trip roster', async () => {
    const item = await createPlace();
    const res = await handleRequest(
      repo,
      req({ method: 'POST', path: `/trips/${TRIP}/items/${item.itemId}/votes`, identity: lewis, body: { voterId: 'ghost', value: 1 } }),
    );
    expect(res.statusCode).toBe(400);
  });

  it('removing a vote reverses the score', async () => {
    const item = await createPlace();
    await handleRequest(repo, req({ method: 'POST', path: `/trips/${TRIP}/items/${item.itemId}/votes`, identity: lewis, body: { voterId: 'user-lewis', value: 1 } }));
    const res = await handleRequest(repo, req({ method: 'DELETE', path: `/trips/${TRIP}/items/${item.itemId}/votes/user-lewis`, identity: lewis }));
    expect(res.statusCode).toBe(200);
    const detail = await repo.getItemDetail(TRIP, item.itemId);
    expect(detail!.item.voteScore).toBe(0);
    expect(detail!.item.voteCount).toBe(0);
  });

  it('comments post with author + bump the counter', async () => {
    const item = await createPlace();
    const res = await handleRequest(repo, req({ method: 'POST', path: `/trips/${TRIP}/items/${item.itemId}/comments`, identity: lewis, body: { text: 'great for the kids' } }));
    expect(res.statusCode).toBe(201);
    const detail = await repo.getItemDetail(TRIP, item.itemId);
    expect(detail!.item.commentCount).toBe(1);
    expect(detail!.comments[0]!.authorName).toBe('Lewis');
  });
});

describe('device join', () => {
  it('joins by typing a name and claiming a seeded member', async () => {
    const repo = makeRepo();
    const res = await handleRequest(
      repo,
      req({ method: 'POST', path: `/trips/${TRIP}/join`, identity: { userId: 'user-steve', name: 'Steve' }, body: { name: 'Steve', userId: 'user-steve', familyId: 'fam-steve' } }),
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as Member).familyId).toBe('fam-steve');
    expect(await repo.getMember(TRIP, 'user-steve')).not.toBeNull();
  });
});

describe('applyItemUpdate', () => {
  const meal: Item = {
    entity: 'item',
    itemId: 'i1',
    tripId: TRIP,
    type: 'MEAL',
    title: 'Lobster rolls',
    mealType: 'dinner',
    isAnchor: false,
    status: 'scheduled',
    scheduledDate: '2026-07-02',
    slot: 'dinner',
    currency: 'CAD',
    tags: [],
    voteScore: 4,
    voteCount: 4,
    commentCount: 0,
    createdByUserId: 'user-lewis',
    createdAt: 'x',
    updatedAt: 'x',
  };

  it('defer to next occasion returns it to suggested, keeping votes', () => {
    const out = applyItemUpdate(meal, { action: 'defer', toMealType: 'dinner' });
    expect(out.status).toBe('suggested');
    expect(out.scheduledDate).toBeUndefined();
    expect(out.voteScore).toBe(4); // votes are children of the item, untouched
  });

  it('defer to a date reschedules it as that meal', () => {
    const out = applyItemUpdate(meal, { action: 'defer', toDate: '2026-07-03' });
    expect(out.status).toBe('scheduled');
    expect(out.scheduledDate).toBe('2026-07-03');
    expect(out.slot).toBe('dinner');
  });

  it('schedule sets date + slot', () => {
    const suggested: Item = { ...meal, status: 'suggested', scheduledDate: undefined, slot: undefined };
    const out = applyItemUpdate(suggested, { status: 'scheduled', scheduledDate: '2026-07-04', slot: 'dinner' });
    expect(out.status).toBe('scheduled');
    expect(out.scheduledDate).toBe('2026-07-04');
  });
});
