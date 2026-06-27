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
    place('item-ferry', 'Alderney Ferry → Halifax', 'other', 44.6647, -63.5664, 'Catch the ferry from Alderney Landing across the harbour — a quick, cheap ride with great skyline views (runs every ~15–30 min). Pays your transit fare.', {
      address: 'Alderney Ferry Terminal, Dartmouth', tags: ['ferry', 'tonight'],
      website: 'https://www.halifax.ca/transportation/halifax-transit/ferry-service/alderney-ferry-schedule',
    }),
    place('item-boardwalk', 'Halifax Waterfront Boardwalk', 'outdoor', 44.6472, -63.5685, 'Right off the Halifax ferry terminal — a 4.4 km harbourfront boardwalk with food, buskers, the blue wave sculpture, and the orange hammocks.', {
      address: 'Halifax Waterfront', tags: ['walkable', 'ferry', 'tonight', 'stroller-friendly'],
      website: 'https://buildns.ca/visit/halifax/',
    }),
    place('item-maritime', 'Maritime Museum of the Atlantic', 'museum', 44.6463, -63.5697, "Canada's oldest/largest maritime museum — Titanic relics and the Halifax Explosion, steps from the ferry.", {
      address: '1675 Lower Water St, Halifax', tags: ['walkable', 'ferry', 'tonight'], estCost: 4000,
      website: 'https://maritimemuseum.novascotia.ca',
    }),
    place('item-historic', 'Historic Properties', 'other', 44.6489, -63.5697, "Canada's oldest surviving waterfront warehouses (Privateers' Wharf) — shops, patios, and ice cream. Short walk from the ferry.", {
      address: '1869 Upper Water St, Halifax', tags: ['walkable', 'ferry', 'tonight'],
      website: 'https://www.historicproperties.ca/',
    }),
    place('item-citadel', 'Halifax Citadel', 'viewpoint', 44.6478, -63.5803, 'Star-shaped 1856 hilltop fort with the noon gun and the best city views — ~15 min uphill walk from the ferry.', {
      address: 'Citadel Hill, Halifax', tags: ['walkable', 'views'], estCost: 0,
      website: 'https://parks.canada.ca/lhn-nhs/ns/halifax',
    }),

    // ---- Day trips & South Shore ----
    place('item-peggys', "Peggy's Cove Lighthouse", 'viewpoint', 44.4915, -63.917, 'Iconic lighthouse on wave-washed granite — free to visit, busiest 11–3. Hold little hands: the black rocks are slippery and dangerous.', {
      address: 'Peggys Cove, NS', tags: ['scenic', 'photos'], website: 'https://visitpeggyscove.ca/',
    }),
    place('item-lunenburg', 'Old Town Lunenburg', 'viewpoint', 44.3762, -64.3079, 'Colourful UNESCO World Heritage town (planned in 1753), ~15 min from the Airbnb. Walkable waterfront, shops, and the Bluenose II home port.', {
      address: 'Lunenburg, NS', tags: ['walkable', 'photos'], website: 'https://www.explorelunenburg.com/',
    }),
    place('item-gardens', 'Halifax Public Gardens', 'outdoor', 44.643, -63.5818, 'The only true Victorian garden in North America — ducks, bandstand, and ice cream. ~15 min walk from the ferry; gates open 8am.', {
      address: 'Spring Garden Rd, Halifax', tags: ['walkable', 'stroller-friendly'], website: 'https://www.halifaxpublicgardens.ca/',
    }),
    place('item-discovery', 'Discovery Centre', 'museum', 44.6448, -63.5664, 'Hands-on science centre by the waterfront — great rainy-day backup for the kids.', {
      address: '1215 Lower Water St, Halifax', tags: ['walkable'], estCost: 5400, website: 'https://thediscoverycentre.ca',
    }),
    place('item-lawrencetown', 'Lawrencetown Beach', 'beach', 44.642, -63.347, 'Atlantic surf beach ~20 min east of Dartmouth — supervised swimming Jul–Aug, but strong rip currents. Boardwalks, change houses, showers.', {
      address: 'Lawrencetown, NS', tags: ['beach', 'surf'], website: 'https://parks.novascotia.ca/park/lawrencetown-beach',
    }),
    place('item-shubie', 'Shubie Park', 'outdoor', 44.708, -63.546, '40-acre Dartmouth park between two lakes — canal locks, easy trails, lake beaches, and the Fairbanks interpretive centre.', {
      address: '54 Locks Rd, Dartmouth', tags: ['trails', 'stroller-friendly'], website: 'https://www.shubenacadiecanal.ca/shubie-park',
    }),
    place('item-clements', 'Upper Clements Trails', 'outdoor', 44.741, -65.604, 'NOTE: the old amusement park closed in 2019. The grounds are now 16 km of hiking/biking trails (near Annapolis Royal, ~2 h away).', {
      address: 'Upper Clements, NS', tags: ['trails'], website: 'https://www.annapoliscounty.ca/community-development/parks-trails/1936-upper-clements-trails',
    }),

    // ---- Restaurants: Halifax waterfront & downtown (real spots; coords approx, tap Open in Maps for exact + menu) ----
    place('item-bicyclethief', 'The Bicycle Thief', 'restaurant', 44.6452, -63.5686, 'Lively Italian-with-a-Maritime-twist at Bishop’s Landing (1475 Lower Water St) — very popular, expect a wait.', { address: '1475 Lower Water St, Halifax', tags: ['walkable', 'tonight'], website: 'https://bicyclethief.ca/' }),
    place('item-waterpolo', 'Water Polo', 'restaurant', 44.6440, -63.5668, 'Seafood on the waterfront at 1325 Lower Water St.', { address: '1325 Lower Water St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-drift', 'Drift', 'restaurant', 44.6460, -63.5683, 'Seafood + cocktails in the Queen’s Marque district on the boardwalk.', { address: '1709 Lower Water St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-seasmoke', 'Sea Smoke', 'restaurant', 44.6464, -63.5684, 'Asian-fusion seafood with one of the best harbour views on the boardwalk.', { address: 'Queen’s Marque, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-gahan', 'Gahan House Harbour', 'restaurant', 44.6470, -63.5688, 'Waterfront brewpub — burgers, fish & chips, house beer; kid-friendly.', { address: 'Cable Wharf, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-stubborngoat', 'The Stubborn Goat', 'restaurant', 44.6479, -63.5731, 'Gastropub on the Argyle St patio strip — good for groups.', { address: '1579 Grafton St, Halifax', tags: ['walkable'], website: 'https://thestubborngoat.ca/' }),
    place('item-fivefish', 'The Five Fishermen', 'restaurant', 44.6483, -63.5736, 'Historic upstairs seafood house with a mussel & salad bar.', { address: '1740 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-woodenmonkeyhfx', 'The Wooden Monkey (Halifax)', 'restaurant', 44.6476, -63.5739, 'Local/organic comfort food, very veg-friendly, downtown.', { address: '1707 Grafton St, Halifax', tags: ['walkable'], website: 'https://www.thewoodenmonkey.ca/' }),
    place('item-2doors', '2 Doors Down', 'restaurant', 44.6455, -63.5740, 'Casual local comfort food off Spring Garden.', { address: '1533 Barrington St, Halifax', tags: ['walkable'] }),
    place('item-yfm', "Your Father's Moustache", 'restaurant', 44.6435, -63.5793, 'Pub classics + rooftop patio on Spring Garden Rd.', { address: '5686 Spring Garden Rd, Halifax', tags: ['walkable'] }),
    place('item-darrells', "Darrell's", 'restaurant', 44.6402, -63.5826, 'Diner famous for the peanut-butter burger; very kid-friendly.', { address: '5576 Fenwick St, Halifax' }),
    place('item-barkismet', 'Bar Kismet', 'restaurant', 44.6585, -63.5945, 'Acclaimed North-End seafood small plates + cocktails (reserve ahead).', { address: '2733 Agricola St, Halifax', website: 'https://barkismet.com/' }),
    place('item-edna', 'EDNA', 'restaurant', 44.6555, -63.5905, 'Buzzy North-End bistro; brunch favourite.', { address: '2053 Gottingen St, Halifax' }),
    place('item-kingofdonair', 'King of Donair', 'restaurant', 44.6470, -63.5980, 'The original Halifax donair (since 1973).', { address: '6420 Quinpool Rd, Halifax' }),
    place('item-cows', 'COWS Creamery', 'restaurant', 44.6470, -63.5683, 'PEI ice cream on the boardwalk — a kid magnet.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),

    // ---- Restaurants: Dartmouth (near the Alderney ferry) ----
    place('item-woodenmonkeydart', 'The Wooden Monkey (Dartmouth)', 'restaurant', 44.6647, -63.5664, 'Top floor of the Alderney ferry terminal — pizzas, pasta, kids’ menu, harbour views. Grab dinner before/after the ferry.', { address: '40 Alderney Dr, Dartmouth', tags: ['walkable', 'tonight'], website: 'https://www.thewoodenmonkey.ca/' }),
    place('item-canteen', 'The Canteen', 'restaurant', 44.6668, -63.5688, 'Steps from the Alderney ferry — haddock burger, falafel bowl, seasonal menu.', { address: '40 Alderney Dr, Dartmouth', tags: ['walkable'] }),
    place('item-batterypark', 'Battery Park', 'restaurant', 44.6678, -63.5703, 'Dartmouth beer bar + wood-fired food, short walk from the ferry.', { address: '62 Ochterloney St, Dartmouth', tags: ['walkable'] }),
    place('item-johnslunch', "John's Lunch", 'restaurant', 44.6452, -63.5650, 'Woodside landmark (since 1969) famous for fish & chips.', { address: '352 Pleasant St, Dartmouth' }),

    // ---- Restaurants: South Shore (near the Rose Bay Airbnb) ----
    place('item-saltshaker', 'Salt Shaker Deli', 'restaurant', 44.3760, -64.3085, 'Lunenburg harbourfront — legendary mussels and big bowls.', { address: '124 Montague St, Lunenburg', tags: ['walkable'] }),
    place('item-fishshack', 'South Shore Fish Shack', 'restaurant', 44.3761, -64.3082, 'Arguably the best fish & chips in Lunenburg — crisp haddock.', { address: '108 Montague St, Lunenburg', tags: ['walkable'] }),
    place('item-rebeccas', "Rebecca's", 'restaurant', 44.4495, -64.3815, 'Waterfront home-cooked local cuisine in Mahone Bay.', { address: 'Mahone Bay, NS' }),

    // ---- More attractions ----
    place('item-naturalhistory', 'Museum of Natural History', 'museum', 44.6510, -63.5817, 'Dinosaurs, Gus the 100-yr-old tortoise, and nature exhibits — kid favourite.', { address: '1747 Summer St, Halifax', tags: ['walkable'], estCost: 6300, website: 'https://naturalhistory.novascotia.ca' }),
    place('item-pier21', 'Canadian Museum of Immigration at Pier 21', 'museum', 44.6418, -63.5667, 'Moving museum of Canadian immigration at the south end of the boardwalk.', { address: '1055 Marginal Rd, Halifax', tags: ['walkable'], website: 'https://pier21.ca' }),
    place('item-agns', 'Art Gallery of Nova Scotia', 'museum', 44.6470, -63.5723, "Provincial art gallery incl. Maud Lewis’s tiny painted house.", { address: '1723 Hollis St, Halifax', tags: ['walkable'], website: 'https://www.artgalleryofnovascotia.ca' }),
    place('item-library', 'Halifax Central Library', 'other', 44.6438, -63.5783, 'Architectural landmark — zany staircases, kids’ area, rooftop view; free.', { address: '5440 Spring Garden Rd, Halifax', tags: ['walkable'] }),
    place('item-harbourhopper', 'Harbour Hopper Tour', 'other', 44.6478, -63.5690, 'Amphibious land-and-sea tour from the boardwalk — a hit with kids.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-pointpleasant', 'Point Pleasant Park', 'outdoor', 44.6235, -63.5665, 'Wooded seaside park with trails, old forts, and off-leash areas.', { address: 'Point Pleasant Dr, Halifax' }),
    place('item-dingle', 'Sir Sandford Fleming Park (The Dingle)', 'outdoor', 44.6300, -63.6125, 'Stone tower, little beach, and trails on the Northwest Arm.', { address: 'Dingle Rd, Halifax' }),
    place('item-fishermanscove', "Fisherman's Cove", 'outdoor', 44.6320, -63.4640, 'Restored fishing village in Eastern Passage — boardwalk, shops, ice cream.', { address: 'Eastern Passage, NS' }),
    place('item-hydrostone', 'Hydrostone Market', 'other', 44.6612, -63.6010, 'Cute North-End block of shops and cafes.', { address: 'Young St, Halifax' }),
    place('item-rainbowhaven', 'Rainbow Haven Beach', 'beach', 44.6430, -63.4180, 'Supervised sandy beach east of Dartmouth — good for kids (Jul–Aug).', { address: 'Cow Bay, NS', tags: ['beach'], website: 'https://parks.novascotia.ca/park/rainbow-haven-beach' }),
    place('item-crystalcrescent', 'Crystal Crescent Beach', 'beach', 44.4560, -63.6190, 'White-sand beaches + coastal hike south of the city.', { address: 'Sambro Creek, NS', tags: ['beach'] }),
    place('item-mahonebay', 'Mahone Bay (Three Churches)', 'viewpoint', 44.4470, -64.3830, 'Postcard town with three waterfront churches; minutes from Lunenburg.', { address: 'Mahone Bay, NS', tags: ['photos'], website: 'https://mahonebay.com' }),
    place('item-fisheriesmuseum', 'Fisheries Museum of the Atlantic', 'museum', 44.3757, -64.3140, 'Lunenburg waterfront museum — aquarium and tall ships.', { address: '68 Bluenose Dr, Lunenburg', tags: ['walkable'], website: 'https://fisheriesmuseum.novascotia.ca' }),
    place('item-wildlifepark', 'Shubenacadie Wildlife Park', 'outdoor', 45.0833, -63.4030, 'Provincial wildlife park — moose, bears, deer to feed (~1 h from Halifax).', { address: 'Shubenacadie, NS', tags: ['kids'], website: 'https://wildlifepark.novascotia.ca' }),

    // ---- Halifax Ferry Terminal (tap as the centre for "within X km") ----
    place('item-hfxterminal', 'Halifax Ferry Terminal', 'other', 44.6476, -63.5683, 'Where the Dartmouth ferry lands in Halifax — the boardwalk starts right here. Tap me and pick a distance to see what’s walkable.', { address: '1 George St, Halifax', tags: ['walkable', 'tonight', 'ferry'] }),

    // ---- Halifax side: more attractions (walkable from the ferry) ----
    place('item-hmcssackville', 'HMCS Sackville', 'museum', 44.6452, -63.5677, "Canada's oldest warship — a floating WWII museum on the boardwalk.", { address: 'Sackville Landing, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-theodoretoo', 'Theodore Too', 'other', 44.6470, -63.5686, 'The big red tugboat from the kids’ show — harbour tours from the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-grandparade', 'Grand Parade & City Hall', 'viewpoint', 44.6489, -63.5741, 'Historic downtown square between City Hall and St. Paul’s — events and buskers.', { address: 'Barrington St, Halifax', tags: ['walkable'] }),
    place('item-stpauls', "St. Paul's Church", 'other', 44.6486, -63.5744, "Canada's oldest Protestant church (1750) on Grand Parade.", { address: '1749 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-provincehouse', 'Province House', 'museum', 44.6483, -63.5727, "Canada's oldest legislature building — free tours.", { address: '1726 Hollis St, Halifax', tags: ['walkable'] }),
    place('item-oldburying', 'Old Burying Ground', 'other', 44.6452, -63.5740, '1749 cemetery and National Historic Site on Barrington St.', { address: 'Barrington St, Halifax', tags: ['walkable'] }),
    place('item-townclock', 'Halifax Town Clock', 'viewpoint', 44.6478, -63.5766, 'The iconic clock on the slope below the Citadel.', { address: 'Brunswick St, Halifax', tags: ['walkable'] }),
    place('item-seaportmarket', 'Halifax Seaport Farmers’ Market', 'other', 44.6428, -63.5667, 'Year-round market at Pier 20 — food stalls and local makers (busiest weekends).', { address: '1209 Marginal Rd, Halifax', tags: ['walkable'] }),
    place('item-georgesisland', 'Georges Island', 'viewpoint', 44.6420, -63.5570, 'Harbour-island fort with tunnels — seasonal tour boats from the waterfront.', { address: 'Halifax Harbour' }),
    place('item-emeraoval', 'Emera Oval', 'outdoor', 44.6470, -63.5840, 'Free skating / biking / blading oval on the Halifax Common (gear rentals).', { address: 'Halifax Common', tags: ['kids'] }),
    place('item-springgarden', 'Spring Garden Road', 'other', 44.6435, -63.5790, "Halifax's main shopping street — shops, cafes, and people-watching.", { address: 'Spring Garden Rd, Halifax', tags: ['walkable'] }),

    // ---- Halifax side: more restaurants ----
    place('item-mckelvies', "McKelvie's", 'restaurant', 44.6470, -63.5710, 'Longtime seafood favourite near the waterfront (Salty’s sister restaurant).', { address: '1680 Lower Water St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-pressgang', 'The Press Gang', 'restaurant', 44.6487, -63.5728, 'Oyster bar + steak/seafood in a 1759 stone building.', { address: '5218 Prince St, Halifax', tags: ['walkable'] }),
    place('item-lotsix', 'Lot Six', 'restaurant', 44.6481, -63.5730, 'Modern bistro on the Argyle St patio strip.', { address: '1685 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-foggygoggle', 'The Foggy Goggle', 'restaurant', 44.6482, -63.5729, 'Casual Argyle St spot — nachos, burgers, big patio.', { address: '1667 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-oldtriangle', 'The Old Triangle', 'restaurant', 44.6489, -63.5732, 'Irish alehouse with live music downtown.', { address: '5136 Prince St, Halifax', tags: ['walkable'] }),
    place('item-durtynellys', "Durty Nelly's", 'restaurant', 44.6481, -63.5728, 'Authentic Irish pub on Argyle St.', { address: '1645 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-henryhouse', 'Henry House', 'restaurant', 44.6433, -63.5715, 'Historic stone pub on Barrington St.', { address: '1222 Barrington St, Halifax' }),
    place('item-morriseast', 'Morris East', 'restaurant', 44.6440, -63.5760, 'Wood-fired pizza and cocktails downtown.', { address: '5212 Morris St, Halifax', tags: ['walkable'] }),
    place('item-envie', 'EnVie', 'restaurant', 44.6548, -63.5910, 'Acclaimed vegan kitchen in the North End.', { address: '5775 Charles St, Halifax' }),
    place('item-fieldguide', 'Field Guide', 'restaurant', 44.6553, -63.5905, 'Inventive small plates on Gottingen St, North End.', { address: '2076 Gottingen St, Halifax' }),
    place('item-brooklynwarehouse', 'Brooklyn Warehouse', 'restaurant', 44.6520, -63.5965, 'Neighbourhood favourite at the top of the North End.', { address: '2795 Windsor St, Halifax' }),
    place('item-freaklunchbox', 'Freak Lunchbox', 'restaurant', 44.6469, -63.5743, 'Wild candy store on Barrington — pure kid joy.', { address: '1729 Barrington St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-sugah', 'Sugah! Confectionery', 'restaurant', 44.6486, -63.5692, 'Boardwalk fudge, candy & ice cream — kid magnet.', { address: 'Historic Properties, Halifax', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-daveslobster', "Dave's Lobster", 'restaurant', 44.6473, -63.5684, 'Lobster rolls to-go right on the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-smokespoutine', "Smoke's Poutinerie", 'restaurant', 44.6481, -63.5727, 'Loaded poutine on Argyle — great late-night snack.', { address: 'Argyle St, Halifax', tags: ['walkable'] }),

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
