/**
 * Seed a deployed DynamoDB table with the demo Nova Scotia trip (six kid spots +
 * an Airbnb anchor + meal suggestions) and the three families, so the app is
 * non-empty on first run.
 *
 * Usage:
 *   TABLE_NAME=TripBoard AWS_REGION=us-east-1 npm run seed
 *
 * Requires AWS credentials in the environment (SSO/role/keys). This is a RESET:
 * it first clears the trip's existing records (trip meta, members, children,
 * items, expenses, and each item's votes/comments) so stale seed data doesn't
 * linger, then writes a fresh copy.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { seedTrip, seedMembers, seedChildren, seedItems, DEMO_TRIP_ID } from '@tripboard/shared';
import { tripRecord, memberRecord, childRecord, itemRecord, itemSk, tripPk, itemPk } from '../services/api/src/keys.js';

const TABLE_NAME = process.env.TABLE_NAME ?? 'TripBoard';

/**
 * Items to permanently remove from the live trip (mistakes / dupes). On each seed
 * run these ids and their votes/comments are deleted. Use sparingly — this DOES
 * drop any votes on the listed item (intentional retirement).
 */
const RETIRED_ITEM_IDS = ['item-bluenoseship'];

type Key = { PK: string; SK: string };

async function queryKeys(ddb: DynamoDBDocumentClient, pk: string): Promise<Key[]> {
  const keys: Key[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': pk },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey,
      }),
    );
    for (const it of res.Items ?? []) keys.push({ PK: it.PK as string, SK: it.SK as string });
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return keys;
}

async function batch(ddb: DynamoDBDocumentClient, requests: { PutRequest?: { Item: Record<string, unknown> }; DeleteRequest?: { Key: Key } }[]): Promise<void> {
  for (let i = 0; i < requests.length; i += 25) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: requests.slice(i, i + 25) } }));
  }
}

async function main(): Promise<void> {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  // Additive by default: only insert items that don't exist yet, so existing
  // items keep their votes/comments and denormalized scores. Set SEED_RESET=1
  // to fully clear and rewrite the trip (wipes votes — use intentionally).
  const reset = process.env.SEED_RESET === '1';

  const existingKeys = await queryKeys(ddb, tripPk(DEMO_TRIP_ID));
  const existingItemIds = new Set(
    existingKeys.filter((k) => k.SK.startsWith('ITEM#')).map((k) => k.SK.slice('ITEM#'.length)),
  );

  if (reset) {
    const childKeys: Key[] = [];
    for (const itemId of existingItemIds) childKeys.push(...(await queryKeys(ddb, itemPk(itemId))));
    const toDelete = [...existingKeys, ...childKeys];
    if (toDelete.length > 0) {
      await batch(ddb, toDelete.map((Key) => ({ DeleteRequest: { Key } })));
      // eslint-disable-next-line no-console
      console.log(`RESET: cleared ${toDelete.length} existing records.`);
    }
    existingItemIds.clear();
  }

  // Retire explicitly-removed items (item row + its votes/comments partition).
  const toRetire = RETIRED_ITEM_IDS.filter((id) => existingItemIds.has(id));
  if (toRetire.length > 0) {
    const delKeys: Key[] = [];
    for (const id of toRetire) {
      delKeys.push({ PK: tripPk(DEMO_TRIP_ID), SK: itemSk(id) });
      delKeys.push(...(await queryKeys(ddb, itemPk(id))));
    }
    await batch(ddb, delKeys.map((Key) => ({ DeleteRequest: { Key } })));
    // eslint-disable-next-line no-console
    console.log(`Retired ${toRetire.length} item(s): ${toRetire.join(', ')}.`);
  }

  // Trip meta + roster are safe to upsert (no votes attached). Items: insert
  // only the ones not already present so we never reset a voted item's score.
  const newItems = seedItems().filter((i) => !existingItemIds.has(i.itemId));
  const records: Record<string, unknown>[] = [
    tripRecord(seedTrip()),
    ...seedMembers().map(memberRecord),
    ...seedChildren().map(childRecord),
    ...newItems.map(itemRecord),
  ];
  await batch(ddb, records.map((Item) => ({ PutRequest: { Item } })));

  // eslint-disable-next-line no-console
  console.log(
    reset
      ? `Seeded ${records.length} records into ${TABLE_NAME}.`
      : `Additive seed: upserted trip/roster + ${newItems.length} new item(s) into ${TABLE_NAME} (existing items & votes preserved).`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
