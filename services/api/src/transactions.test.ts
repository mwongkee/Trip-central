import { describe, it, expect } from 'vitest';
import {
  buildCastVoteTransaction,
  buildDeleteVoteTransaction,
  buildAddCommentTransaction,
} from './transactions.js';
import type { Item, Vote, Comment } from '@tripboard/shared';

const item: Item = {
  entity: 'item',
  itemId: 'i1',
  tripId: 't1',
  type: 'PLACE',
  title: 'x',
  category: 'beach',
  isAnchor: false,
  status: 'suggested',
  currency: 'CAD',
  tags: [],
  voteScore: 2,
  voteCount: 2,
  commentCount: 1,
  createdByUserId: 'u1',
  createdAt: 'x',
  updatedAt: 'x',
};

const vote = (over: Partial<Vote>): Vote => ({
  entity: 'vote',
  itemId: 'i1',
  voterId: 'v1',
  voterType: 'adult',
  voterName: 'Lewis',
  value: 1,
  castByUserId: 'u1',
  createdAt: '2026-06-27T00:00:00Z',
  ...over,
});

describe('buildCastVoteTransaction', () => {
  it('adds a new vote: score+1, count+1, guarded on current values', () => {
    const tx = buildCastVoteTransaction({ tableName: 'T', item, newVote: vote({}), existingVote: null });
    const update = tx.TransactItems![1]!.Update!;
    expect(update.ExpressionAttributeValues![':score']).toBe(3);
    expect(update.ExpressionAttributeValues![':count']).toBe(3);
    expect(update.ExpressionAttributeValues![':gsi2sk']).toBe('9996#ITEM#i1');
    expect(update.ConditionExpression).toContain('voteScore = :curScore');
    expect(tx.TransactItems![0]!.Put!.Item!['SK']).toBe('VOTE#v1');
  });

  it('changing an existing vote applies the delta, not a double count', () => {
    const existing = vote({ value: 1 });
    const tx = buildCastVoteTransaction({ tableName: 'T', item, newVote: vote({ value: -1 }), existingVote: existing });
    const update = tx.TransactItems![1]!.Update!;
    expect(update.ExpressionAttributeValues![':score']).toBe(0); // 2 - 1 + (-1)
    expect(update.ExpressionAttributeValues![':count']).toBe(2); // unchanged
  });
});

describe('buildDeleteVoteTransaction', () => {
  it('reverses the vote contribution', () => {
    const tx = buildDeleteVoteTransaction({
      tableName: 'T',
      item,
      existingVote: vote({ value: 1 }),
      now: 'n',
    });
    const update = tx.TransactItems![1]!.Update!;
    expect(update.ExpressionAttributeValues![':score']).toBe(1);
    expect(update.ExpressionAttributeValues![':count']).toBe(1);
    expect(tx.TransactItems![0]!.Delete!.Key).toEqual({ PK: 'ITEM#i1', SK: 'VOTE#v1' });
  });
});

describe('buildAddCommentTransaction', () => {
  it('puts the comment and increments commentCount', () => {
    const comment: Comment = {
      entity: 'comment',
      itemId: 'i1',
      commentId: 'c1',
      text: 'looks fun',
      authorUserId: 'u1',
      authorName: 'Lewis',
      createdAt: '2026-06-27T00:00:00Z',
    };
    const tx = buildAddCommentTransaction({ tableName: 'T', item, comment });
    expect(tx.TransactItems![0]!.Put!.Item!['SK']).toBe('COMMENT#2026-06-27T00:00:00Z#c1');
    expect(tx.TransactItems![1]!.Update!.UpdateExpression).toContain('commentCount + :one');
  });
});
