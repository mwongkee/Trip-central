/**
 * Seed a deployed DynamoDB table with the demo Nova Scotia trip (six kid spots +
 * an Airbnb anchor + meal suggestions) and the three families, so the app is
 * non-empty on first run.
 *
 * Usage:
 *   TABLE_NAME=TripBoard AWS_REGION=ca-central-1 npm run seed
 *
 * Requires AWS credentials in the environment (SSO/role/keys). Idempotent: it
 * overwrites the seed records with the same keys each run.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { seedTrip, seedMembers, seedChildren, seedItems } from '@tripboard/shared';
import {
  tripRecord,
  memberRecord,
  childRecord,
  itemRecord,
} from '../services/api/src/keys.js';

const TABLE_NAME = process.env.TABLE_NAME ?? 'TripBoard';

async function main(): Promise<void> {
  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  const records: Record<string, unknown>[] = [
    tripRecord(seedTrip()),
    ...seedMembers().map(memberRecord),
    ...seedChildren().map(childRecord),
    ...seedItems().map(itemRecord),
  ];

  // BatchWrite handles 25 items per request.
  for (let i = 0; i < records.length; i += 25) {
    const chunk = records.slice(i, i + 25);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: chunk.map((Item) => ({ PutRequest: { Item } })) },
      }),
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${records.length} records into ${TABLE_NAME}.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
