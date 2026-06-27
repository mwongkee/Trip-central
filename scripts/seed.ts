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
import { tripRecord, memberRecord, childRecord, itemRecord, tripPk, itemPk } from '../services/api/src/keys.js';

const TABLE_NAME = process.env.TABLE_NAME ?? 'TripBoard';

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

  // 1. Clear the trip partition, and each item's vote/comment partition.
  const tripKeys = await queryKeys(ddb, tripPk(DEMO_TRIP_ID));
  const itemIds = tripKeys
    .filter((k) => k.SK.startsWith('ITEM#'))
    .map((k) => k.SK.slice('ITEM#'.length));
  const childKeys: Key[] = [];
  for (const itemId of itemIds) childKeys.push(...(await queryKeys(ddb, itemPk(itemId))));
  const toDelete = [...tripKeys, ...childKeys];
  if (toDelete.length > 0) {
    await batch(ddb, toDelete.map((Key) => ({ DeleteRequest: { Key } })));
    // eslint-disable-next-line no-console
    console.log(`Cleared ${toDelete.length} existing records.`);
  }

  // 2. Write fresh seed.
  const records: Record<string, unknown>[] = [
    tripRecord(seedTrip()),
    ...seedMembers().map(memberRecord),
    ...seedChildren().map(childRecord),
    ...seedItems().map(itemRecord),
  ];
  await batch(ddb, records.map((Item) => ({ PutRequest: { Item } })));

  // eslint-disable-next-line no-console
  console.log(`Seeded ${records.length} records into ${TABLE_NAME}.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
