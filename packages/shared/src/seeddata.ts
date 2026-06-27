import { FAMILIES, DEMO_TRIP_ID } from './families.js';
import type { Trip, Member, ChildProfile, Item } from './schemas.js';

/**
 * Demo trip used by the local (no-backend) mode and by `scripts/seed.ts`.
 * The six Nova Scotia kid spots + an Airbnb anchor + a few meal suggestions,
 * plus the three families so the app is non-empty and votable on first run.
 */

const TS = '2026-06-01T00:00:00.000Z';

export function seedTrip(): Trip {
  return {
    entity: 'trip',
    tripId: DEMO_TRIP_ID,
    name: 'Nova Scotia 2026',
    startDate: '2026-07-01',
    endDate: '2026-07-08',
    baseCurrency: 'CAD',
    timezone: 'America/Halifax',
    inviteCode: 'NS2026',
    createdAt: TS,
    updatedAt: TS,
  };
}

export function seedMembers(): Member[] {
  return FAMILIES.flatMap((fam) =>
    fam.adults.map(
      (a, idx): Member => ({
        entity: 'member',
        tripId: DEMO_TRIP_ID,
        userId: a.userId,
        name: a.name,
        role: idx === 0 ? 'owner' : 'editor',
        familyId: fam.familyId,
        familyName: fam.familyName,
        joinedAt: TS,
      }),
    ),
  );
}

const KID_COLORS = ['#f6a609', '#e8590c', '#2f9e44', '#1971c2', '#9c36b5', '#e64980'];

export function seedChildren(): ChildProfile[] {
  let colorIdx = 0;
  return FAMILIES.flatMap((fam) =>
    fam.kids.map((k): ChildProfile => {
      const color = KID_COLORS[colorIdx % KID_COLORS.length]!;
      colorIdx += 1;
      return {
        entity: 'child',
        tripId: DEMO_TRIP_ID,
        childId: k.childId,
        name: k.name,
        ownerUserId: fam.adults[0]!.userId,
        familyId: fam.familyId,
        familyName: fam.familyName,
        avatarColor: color,
      };
    }),
  );
}

function place(
  itemId: string,
  title: string,
  category: Item['category'],
  lat: number,
  lng: number,
  description: string,
  extra: Partial<Item> = {},
): Item {
  return {
    entity: 'item',
    itemId,
    tripId: DEMO_TRIP_ID,
    type: 'PLACE',
    title,
    description,
    category,
    lat,
    lng,
    isAnchor: false,
    status: 'suggested',
    currency: 'CAD',
    tags: [],
    voteScore: 0,
    voteCount: 0,
    commentCount: 0,
    createdByUserId: 'user-lewis',
    createdAt: TS,
    updatedAt: TS,
    ...extra,
  };
}

function meal(
  itemId: string,
  title: string,
  mealType: Item['mealType'],
  description: string,
  extra: Partial<Item> = {},
): Item {
  return {
    entity: 'item',
    itemId,
    tripId: DEMO_TRIP_ID,
    type: 'MEAL',
    title,
    description,
    mealType,
    isAnchor: false,
    status: 'suggested',
    currency: 'CAD',
    tags: [],
    voteScore: 0,
    voteCount: 0,
    commentCount: 0,
    createdByUserId: 'user-kristin',
    createdAt: TS,
    updatedAt: TS,
    ...extra,
  };
}

export function seedItems(): Item[] {
  return [
    place('item-airbnb', 'The Airbnb (Halifax)', 'lodging', 44.6488, -63.5752, 'Home base for the week.', {
      isAnchor: true,
      anchorRole: 'airbnb',
      address: 'South End, Halifax, NS',
    }),
    place('item-peggys', "Peggy's Cove Lighthouse", 'viewpoint', 44.4915, -63.917, 'Iconic lighthouse and granite rocks — hold little hands near the water.', { address: 'Peggys Cove, NS', tags: ['scenic', 'photos'] }),
    place('item-gardens', 'Halifax Public Gardens', 'outdoor', 44.643, -63.5818, 'Victorian gardens, ducks, and ice cream.', { address: 'Spring Garden Rd, Halifax', tags: ['stroller-friendly'] }),
    place('item-discovery', 'Discovery Centre', 'museum', 44.6476, -63.58, 'Hands-on science centre — great rainy-day backup.', { address: 'Lower Water St, Halifax', estCost: 5400 }),
    place('item-lawrencetown', 'Lawrencetown Beach', 'beach', 44.642, -63.347, 'Surf beach with lifeguards; bring towels.', { address: 'Lawrencetown, NS', tags: ['beach', 'surf'] }),
    place('item-shubie', 'Shubie Park', 'outdoor', 44.708, -63.546, 'Trails, canal locks, and a splash of history.', { address: 'Dartmouth, NS', tags: ['trails'] }),
    place('item-playground', 'Upper Clements Adventure Park', 'playground', 44.741, -65.604, 'Rides and a wooden coaster for the bigger kids.', { address: 'Upper Clements, NS', estCost: 12000 }),
    meal('meal-lobster', 'Lobster rolls at the wharf', 'dinner', 'Fresh rolls on the Halifax waterfront.', {
      lat: 44.6476,
      lng: -63.5683,
      address: 'Halifax Waterfront',
      category: 'restaurant',
    }),
    meal('meal-pancakes', 'Pancake breakfast at the Airbnb', 'breakfast', 'Easy morning before a big day out.'),
    meal('meal-picnic', 'Picnic lunch at the park', 'lunch', 'Pack sandwiches and snacks.'),
  ];
}
