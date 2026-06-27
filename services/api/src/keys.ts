import { scorePad } from '@tripboard/shared';
import type { Item, Vote, Comment, Expense, Member, ChildProfile, Trip } from '@tripboard/shared';

/**
 * Single-table key construction + GSI projections. Pure functions only (no AWS
 * imports) so they can be unit-tested directly. Mirrors docs/data-model.md.
 */

export const tripPk = (tripId: string): string => `TRIP#${tripId}`;
export const itemPk = (itemId: string): string => `ITEM#${itemId}`;

export const metaSk = (): string => 'META';
export const memberSk = (userId: string): string => `MEMBER#${userId}`;
export const childSk = (childId: string): string => `CHILD#${childId}`;
export const itemSk = (itemId: string): string => `ITEM#${itemId}`;
export const voteSk = (voterId: string): string => `VOTE#${voterId}`;
export const commentSk = (createdAt: string, commentId: string): string =>
  `COMMENT#${createdAt}#${commentId}`;
export const expenseSk = (createdAt: string, expenseId: string): string =>
  `EXPENSE#${createdAt}#${expenseId}`;

/** bucket = mealType for MEAL, category for PLACE. */
export function itemBucket(item: Pick<Item, 'type' | 'mealType' | 'category'>): string {
  return (item.type === 'MEAL' ? item.mealType : item.category) ?? 'other';
}

export interface IndexAttrs {
  GSI1PK?: string;
  GSI1SK?: string;
  GSI2PK?: string;
  GSI2SK?: string;
}

/**
 * GSI projection attributes written onto an Item.
 * - GSI1 only when scheduled (powers date-range itinerary).
 * - GSI2 while the item is still browsable (not done/skipped) (powers scored suggestions).
 */
export function itemIndexAttrs(item: Item): IndexAttrs {
  const attrs: IndexAttrs = {};
  if (item.status === 'scheduled' && item.scheduledDate) {
    attrs.GSI1PK = `${tripPk(item.tripId)}#SCHED`;
    attrs.GSI1SK = `${item.scheduledDate}#${item.slot ?? 'zzz'}#ITEM#${item.itemId}`;
  }
  if (item.status === 'suggested' || item.status === 'scheduled') {
    attrs.GSI2PK = `${tripPk(item.tripId)}#${item.type}#${itemBucket(item)}`;
    attrs.GSI2SK = `${scorePad(item.voteScore)}#ITEM#${item.itemId}`;
  }
  return attrs;
}

/** Full DynamoDB record for an Item, including base keys + GSI projections. */
export function itemRecord(item: Item): Record<string, unknown> {
  return {
    PK: tripPk(item.tripId),
    SK: itemSk(item.itemId),
    ...itemIndexAttrs(item),
    ...item,
  };
}

export function tripRecord(trip: Trip): Record<string, unknown> {
  return { PK: tripPk(trip.tripId), SK: metaSk(), ...trip };
}

export function memberRecord(m: Member): Record<string, unknown> {
  return { PK: tripPk(m.tripId), SK: memberSk(m.userId), ...m };
}

export function childRecord(c: ChildProfile): Record<string, unknown> {
  return { PK: tripPk(c.tripId), SK: childSk(c.childId), ...c };
}

export function voteRecord(v: Vote): Record<string, unknown> {
  return { PK: itemPk(v.itemId), SK: voteSk(v.voterId), ...v };
}

export function commentRecord(c: Comment): Record<string, unknown> {
  return { PK: itemPk(c.itemId), SK: commentSk(c.createdAt, c.commentId), ...c };
}

export function expenseRecord(e: Expense): Record<string, unknown> {
  return { PK: tripPk(e.tripId), SK: expenseSk(e.createdAt, e.expenseId), ...e };
}
