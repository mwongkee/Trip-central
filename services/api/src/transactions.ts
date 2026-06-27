import { scorePad } from '@tripboard/shared';
import type { Item, Vote, Comment } from '@tripboard/shared';
import type { TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { itemPk, itemSk, tripPk, voteSk, voteRecord, commentRecord } from './keys.js';

/**
 * Pure builders for the counter-keeping transactions. Each returns the exact
 * TransactWriteCommandInput so the math + key wiring can be unit-tested without AWS.
 * Counters never fan out a read on list views — see docs/data-model.md.
 */

const itemKey = (tripId: string, itemId: string) => ({
  PK: tripPk(tripId),
  SK: itemSk(itemId),
});

/**
 * Upsert a vote and keep the item's denormalized voteScore/voteCount honest.
 * Pass the existing vote (if the voter already voted) so we apply the delta, not a double count.
 * The Update is guarded on the current voteScore to stay correct under concurrent writes.
 */
export function buildCastVoteTransaction(args: {
  tableName: string;
  item: Item;
  newVote: Vote;
  existingVote: Vote | null;
}): TransactWriteCommandInput {
  const { tableName, item, newVote, existingVote } = args;
  const oldValue = existingVote?.value ?? 0;
  const newScore = item.voteScore - oldValue + newVote.value;
  const newCount = item.voteCount + (existingVote ? 0 : 1);

  return {
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: voteRecord(newVote),
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: itemKey(item.tripId, item.itemId),
          UpdateExpression:
            'SET voteScore = :score, voteCount = :count, GSI2SK = :gsi2sk, updatedAt = :now',
          ConditionExpression: 'voteScore = :curScore AND voteCount = :curCount',
          ExpressionAttributeValues: {
            ':score': newScore,
            ':count': newCount,
            ':gsi2sk': `${scorePad(newScore)}#ITEM#${item.itemId}`,
            ':now': newVote.createdAt,
            ':curScore': item.voteScore,
            ':curCount': item.voteCount,
          },
        },
      },
    ],
  };
}

/** Remove a vote and reverse its contribution to the counters. */
export function buildDeleteVoteTransaction(args: {
  tableName: string;
  item: Item;
  existingVote: Vote;
  now: string;
}): TransactWriteCommandInput {
  const { tableName, item, existingVote, now } = args;
  const newScore = item.voteScore - existingVote.value;
  const newCount = Math.max(0, item.voteCount - 1);

  return {
    TransactItems: [
      {
        Delete: {
          TableName: tableName,
          Key: { PK: itemPk(item.itemId), SK: voteSk(existingVote.voterId) },
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: itemKey(item.tripId, item.itemId),
          UpdateExpression:
            'SET voteScore = :score, voteCount = :count, GSI2SK = :gsi2sk, updatedAt = :now',
          ConditionExpression: 'voteScore = :curScore AND voteCount = :curCount',
          ExpressionAttributeValues: {
            ':score': newScore,
            ':count': newCount,
            ':gsi2sk': `${scorePad(newScore)}#ITEM#${item.itemId}`,
            ':now': now,
            ':curScore': item.voteScore,
            ':curCount': item.voteCount,
          },
        },
      },
    ],
  };
}

/** Add a comment and bump the item's commentCount in one transaction. */
export function buildAddCommentTransaction(args: {
  tableName: string;
  item: Item;
  comment: Comment;
}): TransactWriteCommandInput {
  const { tableName, item, comment } = args;
  return {
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: commentRecord(comment),
        },
      },
      {
        Update: {
          TableName: tableName,
          Key: itemKey(item.tripId, item.itemId),
          UpdateExpression: 'SET commentCount = commentCount + :one, updatedAt = :now',
          ExpressionAttributeValues: { ':one': 1, ':now': comment.createdAt },
        },
      },
    ],
  };
}
