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

/** Deterministic placeholder photo so every activity has an image; swap for real ones via edit. */
function photo(itemId: string): string {
  return `https://picsum.photos/seed/${itemId}/800/500`;
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
    imageUrl: photo(itemId),
    isAnchor: false,
    status: 'suggested',
    currency: 'CAD',
    tags: [],
    voteScore: 0,
    voteCount: 0,
    commentCount: 0,
    createdByUserId: 'user-matt',
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
    imageUrl: photo(itemId),
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
    // ---- Anchors ----
    place('item-airbnb', 'The Airbnb (Rose Bay)', 'lodging', 44.3462, -64.2668, 'Home base on the South Shore, near Lunenburg.', {
      isAnchor: true,
      anchorRole: 'airbnb',
      address: 'Rose Bay, NS',
    }),
    place('item-hotel', 'The Hotel (Dartmouth)', 'lodging', 44.6655, -63.5669, 'Second base in Dartmouth, by the Alderney ferry.', {
      isAnchor: true,
      anchorRole: 'hotel',
      address: 'Downtown Dartmouth, NS',
    }),

    // ---- Tonight: ferry Dartmouth → Halifax, then walk the waterfront ----
    place('item-ferry', 'Alderney Ferry → Halifax', 'other', 44.6647, -63.5664, 'Catch the ferry from Alderney Landing across the harbour. Quick, fun ride with great skyline views.', {
      address: 'Alderney Landing, Dartmouth', tags: ['ferry', 'tonight'],
    }),
    place('item-boardwalk', 'Halifax Waterfront Boardwalk', 'outdoor', 44.6472, -63.5685, 'Right off the Halifax ferry terminal — a 4 km boardwalk with food, buskers, and the wave sculpture.', {
      address: 'Halifax Waterfront', tags: ['walkable', 'ferry', 'tonight', 'stroller-friendly'],
    }),
    place('item-maritime', 'Maritime Museum of the Atlantic', 'museum', 44.6463, -63.5697, 'Titanic + shipwreck exhibits, steps from the ferry. Open some evenings.', {
      address: '1675 Lower Water St, Halifax', tags: ['walkable', 'ferry', 'tonight'], estCost: 4000,
      website: 'https://maritimemuseum.novascotia.ca',
    }),
    place('item-historic', 'Historic Properties', 'other', 44.6489, -63.5697, 'Restored waterfront warehouses — shops, patios, and ice cream. Short walk from the ferry.', {
      address: 'Upper Water St, Halifax', tags: ['walkable', 'ferry', 'tonight'],
    }),
    place('item-citadel', 'Halifax Citadel', 'viewpoint', 44.6478, -63.5803, 'Star-shaped hilltop fort with the best city views — ~15 min uphill walk from the ferry.', {
      address: 'Citadel Hill, Halifax', tags: ['walkable', 'views'],
    }),

    // ---- Day trips & South Shore ----
    place('item-peggys', "Peggy's Cove Lighthouse", 'viewpoint', 44.4915, -63.917, 'Iconic lighthouse and granite rocks — hold little hands near the water.', { address: 'Peggys Cove, NS', tags: ['scenic', 'photos'] }),
    place('item-lunenburg', 'Old Town Lunenburg', 'viewpoint', 44.3762, -64.3079, 'Colourful UNESCO waterfront town, 15 min from the Airbnb.', { address: 'Lunenburg, NS', tags: ['walkable', 'photos'] }),
    place('item-gardens', 'Halifax Public Gardens', 'outdoor', 44.643, -63.5818, 'Victorian gardens, ducks, and ice cream — ~15 min walk from the ferry.', { address: 'Spring Garden Rd, Halifax', tags: ['walkable', 'stroller-friendly'] }),
    place('item-discovery', 'Discovery Centre', 'museum', 44.6448, -63.5664, 'Hands-on science centre by the waterfront — great rainy-day backup.', { address: 'Lower Water St, Halifax', tags: ['walkable'], estCost: 5400, website: 'https://thediscoverycentre.ca' }),
    place('item-lawrencetown', 'Lawrencetown Beach', 'beach', 44.642, -63.347, 'Surf beach with lifeguards; bring towels.', { address: 'Lawrencetown, NS', tags: ['beach', 'surf'] }),
    place('item-shubie', 'Shubie Park', 'outdoor', 44.708, -63.546, 'Trails, canal locks, and a splash of history in Dartmouth.', { address: 'Dartmouth, NS', tags: ['trails'] }),
    place('item-playground', 'Upper Clements Adventure Park', 'playground', 44.741, -65.604, 'Rides and a wooden coaster for the bigger kids.', { address: 'Upper Clements, NS', estCost: 12000 }),

    // ---- Meals ----
    meal('meal-lobster', 'Lobster rolls on the boardwalk', 'dinner', 'Fresh rolls on the Halifax waterfront — perfect after the ferry tonight.', {
      lat: 44.6476, lng: -63.5683, address: 'Halifax Waterfront', category: 'restaurant', tags: ['walkable', 'ferry', 'tonight'],
    }),
    meal('meal-beavertails', 'BeaverTails on the waterfront', 'snack', 'Sweet treat while you walk the boardwalk.', {
      lat: 44.6468, lng: -63.5684, address: 'Halifax Waterfront', category: 'restaurant', tags: ['walkable', 'ferry', 'tonight'],
    }),
    meal('meal-pancakes', 'Pancake breakfast at the Airbnb', 'breakfast', 'Easy morning before a big day out.'),
    meal('meal-picnic', 'Picnic lunch at the park', 'lunch', 'Pack sandwiches and snacks.'),
  ];
}
