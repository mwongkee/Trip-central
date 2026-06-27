import { describe, it, expect } from 'vitest';
import { itemIndexAttrs, itemRecord, itemBucket } from './keys.js';
import type { Item } from '@tripboard/shared';

const baseItem = (over: Partial<Item>): Item => ({
  entity: 'item',
  itemId: 'i1',
  tripId: 't1',
  type: 'PLACE',
  title: 'Peggys Cove',
  category: 'viewpoint',
  isAnchor: false,
  status: 'suggested',
  currency: 'CAD',
  tags: [],
  voteScore: 0,
  voteCount: 0,
  commentCount: 0,
  createdByUserId: 'u1',
  createdAt: 'x',
  updatedAt: 'x',
  ...over,
});

describe('itemBucket', () => {
  it('uses category for PLACE and mealType for MEAL', () => {
    expect(itemBucket({ type: 'PLACE', category: 'beach' })).toBe('beach');
    expect(itemBucket({ type: 'MEAL', mealType: 'dinner' })).toBe('dinner');
    expect(itemBucket({ type: 'PLACE' })).toBe('other');
  });
});

describe('itemIndexAttrs', () => {
  it('sets GSI2 for suggested items, scored so higher sorts first', () => {
    const a = itemIndexAttrs(baseItem({ voteScore: 5 }));
    expect(a.GSI2PK).toBe('TRIP#t1#PLACE#viewpoint');
    expect(a.GSI2SK).toBe('9994#ITEM#i1');
    expect(a.GSI1PK).toBeUndefined();
  });
  it('sets GSI1 only when scheduled', () => {
    const a = itemIndexAttrs(baseItem({ status: 'scheduled', scheduledDate: '2026-07-02', slot: 'morning' }));
    expect(a.GSI1PK).toBe('TRIP#t1#SCHED');
    expect(a.GSI1SK).toBe('2026-07-02#morning#ITEM#i1');
  });
  it('drops both GSIs once done', () => {
    const a = itemIndexAttrs(baseItem({ status: 'done' }));
    expect(a.GSI1PK).toBeUndefined();
    expect(a.GSI2PK).toBeUndefined();
  });
  it('buckets MEAL by mealType', () => {
    const a = itemIndexAttrs(baseItem({ type: 'MEAL', category: undefined, mealType: 'dinner' }));
    expect(a.GSI2PK).toBe('TRIP#t1#MEAL#dinner');
  });
});

describe('itemRecord', () => {
  it('writes base keys alongside the item fields', () => {
    const r = itemRecord(baseItem({}));
    expect(r['PK']).toBe('TRIP#t1');
    expect(r['SK']).toBe('ITEM#i1');
    expect(r['title']).toBe('Peggys Cove');
  });
});
