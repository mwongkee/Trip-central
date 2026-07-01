import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Item,
  Vote,
  Comment,
  Expense,
  Member,
  ChildProfile,
  TripBundle,
  ItemDetail,
  Presence,
} from '@tripboard/shared';
import {
  tripPk,
  itemPk,
  itemSk,
  voteSk,
  childSk,
  itemRecord,
  voteRecord,
  memberRecord,
  childRecord,
  expenseRecord,
  presenceRecord,
  presenceSk,
} from './keys.js';
import {
  buildCastVoteTransaction,
  buildDeleteVoteTransaction,
  buildAddCommentTransaction,
} from './transactions.js';

export interface ItemFilter {
  type?: string;
  status?: string;
  bucket?: string;
}

/** The persistence contract the router depends on (real impl below; in-memory in tests). */
export interface Repo {
  getTripBundle(tripId: string): Promise<TripBundle | null>;
  listItems(tripId: string, filter?: ItemFilter): Promise<Item[]>;
  getItem(tripId: string, itemId: string): Promise<Item | null>;
  putItem(item: Item): Promise<Item>;
  deleteItem(tripId: string, itemId: string): Promise<void>;
  getItemDetail(tripId: string, itemId: string): Promise<ItemDetail | null>;
  getVote(itemId: string, voterId: string): Promise<Vote | null>;
  castVote(tripId: string, vote: Vote): Promise<{ item: Item; vote: Vote }>;
  deleteVote(tripId: string, itemId: string, voterId: string, now: string): Promise<Item>;
  listComments(itemId: string): Promise<Comment[]>;
  addComment(tripId: string, comment: Comment): Promise<{ item: Item; comment: Comment }>;
  listChildren(tripId: string): Promise<ChildProfile[]>;
  putChild(child: ChildProfile): Promise<ChildProfile>;
  deleteChild(tripId: string, childId: string): Promise<void>;
  listExpenses(tripId: string): Promise<Expense[]>;
  putExpense(expense: Expense): Promise<Expense>;
  deleteExpense(tripId: string, expenseId: string, createdAt: string): Promise<void>;
  upsertMember(member: Member): Promise<Member>;
  getMember(tripId: string, userId: string): Promise<Member | null>;
  putPresence(presence: Presence, ttlEpochSeconds: number): Promise<Presence>;
  listPresence(tripId: string): Promise<Presence[]>;
  deletePresence(tripId: string, userId: string): Promise<void>;
}

// Optimistic-lock retries for the denormalized vote counters. Needs to comfortably
// exceed the number of voters that might hit one item at once (a whole family +
// other devices) so no vote is dropped under contention.
const MAX_TX_RETRIES = 12;

function isConditionalFailure(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? '';
  return name === 'ConditionalCheckFailedException' || name === 'TransactionCanceledException';
}

/** Small randomized backoff so colliding writers don't re-collide in lockstep. */
function backoff(attempt: number): Promise<void> {
  const ms = Math.min(200, 15 * (attempt + 1)) + Math.floor(Math.random() * 25);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DynamoRepo implements Repo {
  constructor(
    private readonly ddb: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private async queryAll(input: QueryCommand['input']): Promise<Record<string, unknown>[]> {
    const out: Record<string, unknown>[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const res = await this.ddb.send(
        new QueryCommand({ ...input, ExclusiveStartKey }),
      );
      out.push(...((res.Items ?? []) as Record<string, unknown>[]));
      ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (ExclusiveStartKey);
    return out;
  }

  async getTripBundle(tripId: string): Promise<TripBundle | null> {
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': tripPk(tripId) },
    });
    const trip = rows.find((r) => r['entity'] === 'trip');
    if (!trip) return null;
    return {
      trip: trip as TripBundle['trip'],
      members: rows.filter((r) => r['entity'] === 'member') as Member[],
      children: rows.filter((r) => r['entity'] === 'child') as ChildProfile[],
      items: rows.filter((r) => r['entity'] === 'item') as Item[],
    };
  }

  async listItems(tripId: string, filter: ItemFilter = {}): Promise<Item[]> {
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': tripPk(tripId), ':sk': 'ITEM#' },
    });
    let items = rows as Item[];
    if (filter.type) items = items.filter((i) => i.type === filter.type);
    if (filter.status) items = items.filter((i) => i.status === filter.status);
    if (filter.bucket)
      items = items.filter((i) => (i.type === 'MEAL' ? i.mealType : i.category) === filter.bucket);
    return items;
  }

  async getItem(tripId: string, itemId: string): Promise<Item | null> {
    const res = await this.ddb.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: tripPk(tripId), SK: itemSk(itemId) } }),
    );
    return (res.Item as Item | undefined) ?? null;
  }

  async putItem(item: Item): Promise<Item> {
    await this.ddb.send(new PutCommand({ TableName: this.tableName, Item: itemRecord(item) }));
    return item;
  }

  async deleteItem(tripId: string, itemId: string): Promise<void> {
    // Delete the item plus its vote/comment children (one extra query at family scale).
    const children = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': itemPk(itemId) },
    });
    await Promise.all(
      children.map((c) =>
        this.ddb.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { PK: c['PK'] as string, SK: c['SK'] as string },
          }),
        ),
      ),
    );
    await this.ddb.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: tripPk(tripId), SK: itemSk(itemId) },
      }),
    );
  }

  async getItemDetail(tripId: string, itemId: string): Promise<ItemDetail | null> {
    const item = await this.getItem(tripId, itemId);
    if (!item) return null;
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': itemPk(itemId) },
    });
    return {
      item,
      votes: rows.filter((r) => r['entity'] === 'vote') as Vote[],
      comments: rows.filter((r) => r['entity'] === 'comment') as Comment[],
    };
  }

  async getVote(itemId: string, voterId: string): Promise<Vote | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: itemPk(itemId), SK: voteSk(voterId) },
      }),
    );
    return (res.Item as Vote | undefined) ?? null;
  }

  async castVote(tripId: string, vote: Vote): Promise<{ item: Item; vote: Vote }> {
    for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt += 1) {
      const item = await this.getItem(tripId, vote.itemId);
      if (!item) throw new NotFoundError('item not found');
      const existingVote = await this.getVote(vote.itemId, vote.voterId);
      const tx = buildCastVoteTransaction({ tableName: this.tableName, item, newVote: vote, existingVote });
      try {
        await this.ddb.send(new TransactWriteCommand(tx));
        const oldValue = existingVote?.value ?? 0;
        return {
          vote,
          item: {
            ...item,
            voteScore: item.voteScore - oldValue + vote.value,
            voteCount: item.voteCount + (existingVote ? 0 : 1),
            updatedAt: vote.createdAt,
          },
        };
      } catch (err) {
        if (isConditionalFailure(err) && attempt < MAX_TX_RETRIES - 1) { await backoff(attempt); continue; }
        throw err;
      }
    }
    throw new Error('castVote: exhausted retries');
  }

  async deleteVote(tripId: string, itemId: string, voterId: string, now: string): Promise<Item> {
    for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt += 1) {
      const item = await this.getItem(tripId, itemId);
      if (!item) throw new NotFoundError('item not found');
      const existingVote = await this.getVote(itemId, voterId);
      if (!existingVote) return item; // already gone
      const tx = buildDeleteVoteTransaction({ tableName: this.tableName, item, existingVote, now });
      try {
        await this.ddb.send(new TransactWriteCommand(tx));
        return {
          ...item,
          voteScore: item.voteScore - existingVote.value,
          voteCount: Math.max(0, item.voteCount - 1),
          updatedAt: now,
        };
      } catch (err) {
        if (isConditionalFailure(err) && attempt < MAX_TX_RETRIES - 1) { await backoff(attempt); continue; }
        throw err;
      }
    }
    throw new Error('deleteVote: exhausted retries');
  }

  async listComments(itemId: string): Promise<Comment[]> {
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': itemPk(itemId), ':sk': 'COMMENT#' },
    });
    return rows as Comment[];
  }

  async addComment(tripId: string, comment: Comment): Promise<{ item: Item; comment: Comment }> {
    const item = await this.getItem(tripId, comment.itemId);
    if (!item) throw new NotFoundError('item not found');
    const tx = buildAddCommentTransaction({ tableName: this.tableName, item, comment });
    await this.ddb.send(new TransactWriteCommand(tx));
    return { comment, item: { ...item, commentCount: item.commentCount + 1 } };
  }

  async listChildren(tripId: string): Promise<ChildProfile[]> {
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': tripPk(tripId), ':sk': 'CHILD#' },
    });
    return rows as ChildProfile[];
  }

  async putChild(child: ChildProfile): Promise<ChildProfile> {
    await this.ddb.send(new PutCommand({ TableName: this.tableName, Item: childRecord(child) }));
    return child;
  }

  async deleteChild(tripId: string, childId: string): Promise<void> {
    await this.ddb.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: tripPk(tripId), SK: childSk(childId) },
      }),
    );
  }

  async listExpenses(tripId: string): Promise<Expense[]> {
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': tripPk(tripId), ':sk': 'EXPENSE#' },
    });
    return rows as Expense[];
  }

  async putExpense(expense: Expense): Promise<Expense> {
    await this.ddb.send(new PutCommand({ TableName: this.tableName, Item: expenseRecord(expense) }));
    return expense;
  }

  async deleteExpense(tripId: string, expenseId: string, createdAt: string): Promise<void> {
    await this.ddb.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: tripPk(tripId), SK: `EXPENSE#${createdAt}#${expenseId}` },
      }),
    );
  }

  async upsertMember(member: Member): Promise<Member> {
    await this.ddb.send(new PutCommand({ TableName: this.tableName, Item: memberRecord(member) }));
    return member;
  }

  async getMember(tripId: string, userId: string): Promise<Member | null> {
    const res = await this.ddb.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: tripPk(tripId), SK: `MEMBER#${userId}` },
      }),
    );
    return (res.Item as Member | undefined) ?? null;
  }

  async putPresence(presence: Presence, ttlEpochSeconds: number): Promise<Presence> {
    await this.ddb.send(
      new PutCommand({ TableName: this.tableName, Item: presenceRecord(presence, ttlEpochSeconds) }),
    );
    return presence;
  }

  async listPresence(tripId: string): Promise<Presence[]> {
    const rows = await this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { ':pk': tripPk(tripId), ':sk': 'PRESENCE#' },
    });
    return rows as Presence[];
  }

  async deletePresence(tripId: string, userId: string): Promise<void> {
    await this.ddb.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: tripPk(tripId), SK: presenceSk(userId) },
      }),
    );
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
}
