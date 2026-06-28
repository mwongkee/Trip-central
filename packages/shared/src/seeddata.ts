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
    place('item-ferry', 'Alderney Ferry → Halifax', 'activity', 44.6647, -63.5664, 'Catch the ferry from Alderney Landing across the harbour — a quick, cheap ride with great skyline views (runs every ~15–30 min). Pays your transit fare.', {
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
    place('item-historic', 'Historic Properties', 'landmark', 44.6489, -63.5697, "Canada's oldest surviving waterfront warehouses (Privateers' Wharf) — shops, patios, and ice cream. Short walk from the ferry.", {
      address: '1869 Upper Water St, Halifax', tags: ['walkable', 'ferry', 'tonight'],
      website: 'https://www.historicproperties.ca/',
    }),
    place('item-citadel', 'Halifax Citadel', 'landmark', 44.6478, -63.5803, 'Star-shaped 1856 hilltop fort with the noon gun and the best city views — ~15 min uphill walk from the ferry.', {
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
    place('item-library', 'Halifax Central Library', 'landmark', 44.6438, -63.5783, 'Architectural landmark — zany staircases, kids’ area, rooftop view; free.', { address: '5440 Spring Garden Rd, Halifax', tags: ['walkable'] }),
    place('item-harbourhopper', 'Harbour Hopper Tour', 'activity', 44.6478, -63.5690, 'Amphibious land-and-sea tour from the boardwalk — a hit with kids.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-pointpleasant', 'Point Pleasant Park', 'outdoor', 44.6235, -63.5665, 'Wooded seaside park with trails, old forts, and off-leash areas.', { address: 'Point Pleasant Dr, Halifax' }),
    place('item-dingle', 'Sir Sandford Fleming Park (The Dingle)', 'outdoor', 44.6300, -63.6125, 'Stone tower, little beach, and trails on the Northwest Arm.', { address: 'Dingle Rd, Halifax' }),
    place('item-fishermanscove', "Fisherman's Cove", 'outdoor', 44.6320, -63.4640, 'Restored fishing village in Eastern Passage — boardwalk, shops, ice cream.', { address: 'Eastern Passage, NS' }),
    place('item-hydrostone', 'Hydrostone Market', 'shopping', 44.6612, -63.6010, 'Cute North-End block of shops and cafes.', { address: 'Young St, Halifax' }),
    place('item-rainbowhaven', 'Rainbow Haven Beach', 'beach', 44.6430, -63.4180, 'Supervised sandy beach east of Dartmouth — good for kids (Jul–Aug).', { address: 'Cow Bay, NS', tags: ['beach'], website: 'https://parks.novascotia.ca/park/rainbow-haven-beach' }),
    place('item-crystalcrescent', 'Crystal Crescent Beach', 'beach', 44.4560, -63.6190, 'White-sand beaches + coastal hike south of the city.', { address: 'Sambro Creek, NS', tags: ['beach'] }),
    place('item-mahonebay', 'Mahone Bay (Three Churches)', 'viewpoint', 44.4470, -64.3830, 'Postcard town with three waterfront churches; minutes from Lunenburg.', { address: 'Mahone Bay, NS', tags: ['photos'], website: 'https://mahonebay.com' }),
    place('item-fisheriesmuseum', 'Fisheries Museum of the Atlantic', 'museum', 44.3757, -64.3140, 'Lunenburg waterfront museum — aquarium and tall ships.', { address: '68 Bluenose Dr, Lunenburg', tags: ['walkable'], website: 'https://fisheriesmuseum.novascotia.ca' }),
    place('item-wildlifepark', 'Shubenacadie Wildlife Park', 'outdoor', 45.0833, -63.4030, 'Provincial wildlife park — moose, bears, deer to feed (~1 h from Halifax).', { address: 'Shubenacadie, NS', tags: ['kids'], website: 'https://wildlifepark.novascotia.ca' }),

    // ---- Halifax Ferry Terminal (tap as the centre for "within X km") ----
    place('item-hfxterminal', 'Halifax Ferry Terminal', 'other', 44.6476, -63.5683, 'Where the Dartmouth ferry lands in Halifax — the boardwalk starts right here. Tap me and pick a distance to see what’s walkable.', { address: '1 George St, Halifax', tags: ['walkable', 'tonight', 'ferry'] }),

    // ---- Halifax side: more attractions (walkable from the ferry) ----
    place('item-hmcssackville', 'HMCS Sackville', 'museum', 44.6452, -63.5677, "Canada's oldest warship — a floating WWII museum on the boardwalk.", { address: 'Sackville Landing, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-theodoretoo', 'Theodore Too', 'activity', 44.6470, -63.5686, 'The big red tugboat from the kids’ show — harbour tours from the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-grandparade', 'Grand Parade & City Hall', 'landmark', 44.6489, -63.5741, 'Historic downtown square between City Hall and St. Paul’s — events and buskers.', { address: 'Barrington St, Halifax', tags: ['walkable'] }),
    place('item-stpauls', "St. Paul's Church", 'landmark', 44.6486, -63.5744, "Canada's oldest Protestant church (1750) on Grand Parade.", { address: '1749 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-provincehouse', 'Province House', 'museum', 44.6483, -63.5727, "Canada's oldest legislature building — free tours.", { address: '1726 Hollis St, Halifax', tags: ['walkable'] }),
    place('item-oldburying', 'Old Burying Ground', 'landmark', 44.6452, -63.5740, '1749 cemetery and National Historic Site on Barrington St.', { address: 'Barrington St, Halifax', tags: ['walkable'] }),
    place('item-townclock', 'Halifax Town Clock', 'landmark', 44.6478, -63.5766, 'The iconic clock on the slope below the Citadel.', { address: 'Brunswick St, Halifax', tags: ['walkable'] }),
    place('item-seaportmarket', 'Halifax Seaport Farmers’ Market', 'shopping', 44.6428, -63.5667, 'Year-round market at Pier 20 — food stalls and local makers (busiest weekends).', { address: '1209 Marginal Rd, Halifax', tags: ['walkable'] }),
    place('item-georgesisland', 'Georges Island', 'landmark', 44.6420, -63.5570, 'Harbour-island fort with tunnels — seasonal tour boats from the waterfront.', { address: 'Halifax Harbour' }),
    place('item-emeraoval', 'Emera Oval', 'activity', 44.6470, -63.5840, 'Free skating / biking / blading oval on the Halifax Common (gear rentals).', { address: 'Halifax Common', tags: ['kids'] }),
    place('item-springgarden', 'Spring Garden Road', 'shopping', 44.6435, -63.5790, "Halifax's main shopping street — shops, cafes, and people-watching.", { address: 'Spring Garden Rd, Halifax', tags: ['walkable'] }),

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

    // ---- Indoor / rainy-day & active fun ----
    place('item-flyingsquirrel', 'Flying Squirrel Trampoline Park', 'activity', 44.6455, -63.6490, 'Trampolines, foam pits, dodgeball and climbing walls in Bayers Lake.', { address: 'Bayers Lake, Halifax', tags: ['kids', 'rainy-day'], website: 'https://flyingsquirrelsports.ca' }),
    place('item-getair', 'Get Air Halifax', 'activity', 44.7010, -63.5590, 'Indoor trampoline + ninja course in Burnside, Dartmouth.', { address: 'Burnside, Dartmouth', tags: ['kids', 'rainy-day'], website: 'https://getairsports.com' }),
    place('item-kidsfunfactory', 'The Kids Fun Factory', 'playground', 44.6760, -63.5450, 'Big indoor playground — tunnels, ball pit, multi-tier climber, Dartmouth.', { address: 'Dartmouth', tags: ['kids', 'rainy-day'] }),
    place('item-hopskipjump', 'Hop Skip Jump', 'playground', 44.6490, -63.6130, 'Three-level indoor play structure + toddler area and coffee bar.', { address: 'Halifax', tags: ['kids', 'rainy-day'] }),
    place('item-millplaycafe', 'The Mill Play Cafe', 'playground', 44.7250, -63.6580, 'Indoor playground with sensory garden and role-play areas, Lower Sackville.', { address: 'Lower Sackville', tags: ['kids', 'rainy-day'], website: 'https://themillplaycafe.com' }),
    place('item-playdium', 'Playdium Dartmouth', 'activity', 44.6958, -63.5675, 'Arcade, VR, and 10-pin bowling at Dartmouth Crossing.', { address: 'Dartmouth Crossing', tags: ['kids', 'rainy-day'] }),
    place('item-bowlaramabayers', 'Bowlarama Bayers Lake', 'activity', 44.6450, -63.6480, 'Bowling, laser tag and arcade for indoor family nights.', { address: 'Bayers Lake, Halifax', tags: ['kids', 'rainy-day'], website: 'https://bowlarama.ca' }),
    place('item-trapped', 'Trapped Halifax', 'activity', 44.6455, -63.6470, 'Escape rooms with puzzles — good for families and teens.', { address: 'Bayers Lake, Halifax', tags: ['kids', 'rainy-day'], website: 'https://trappedhalifax.com' }),

    // ---- Beaches & easy nature (day-trippable) ----
    place('item-longlake', 'Long Lake Provincial Park', 'outdoor', 44.6240, -63.6480, 'Easy wooded loop trails and lake swimming minutes from the city.', { address: 'Halifax', tags: ['trails', 'kids'] }),
    place('item-queensland', 'Queensland Beach', 'beach', 44.6230, -64.0290, 'Warm sandy beach with easy parking, ~30 min from Halifax.', { address: 'Queensland, NS', tags: ['beach', 'kids', 'daytrip'] }),
    place('item-bayswater', 'Bayswater Beach', 'beach', 44.5560, -64.0270, 'White-sand South Shore beach with warm water and picnic tables.', { address: 'Bayswater, NS', tags: ['beach', 'kids', 'daytrip'] }),
    place('item-clamharbour', 'Clam Harbour Beach', 'beach', 44.7170, -62.8770, 'Long shallow warm beach, famous for its sandcastle competition (Eastern Shore).', { address: 'Clam Harbour, NS', tags: ['beach', 'kids', 'daytrip'] }),
    place('item-martinique', 'Martinique Beach', 'beach', 44.7000, -63.1300, "NS's longest sandy beach — boardwalks, birding, surfing (Eastern Shore).", { address: 'Musquodoboit Harbour, NS', tags: ['beach', 'daytrip'] }),
    place('item-sullivanspond', "Sullivan's Pond", 'outdoor', 44.6685, -63.5712, 'Duck/swan pond with an easy boardwalk loop, downtown Dartmouth.', { address: 'Dartmouth', tags: ['walkable', 'kids', 'photos'] }),

    // ---- Farms, animals & u-pick (day trips) ----
    place('item-hatfield', 'Hatfield Farm', 'outdoor', 44.7000, -63.7600, 'Farm with pony/wagon rides, petting zoo and inflatable water course, Hammonds Plains.', { address: 'Hammonds Plains, NS', tags: ['kids', 'daytrip'], website: 'https://hatfieldfarm.com' }),
    place('item-atlanticsplash', 'Atlantic Splash Adventure', 'outdoor', 44.7920, -63.5460, "NS's largest water/amusement park — slides, go-karts, mini-golf (Windsor Jct).", { address: 'Windsor Junction, NS', tags: ['kids', 'daytrip'], website: 'https://splashadventure.ca' }),
    place('item-coleharbourfarm', 'Cole Harbour Heritage Farm', 'museum', 44.6700, -63.4760, 'Working community farm with animals, gardens and a blacksmith (by donation).', { address: 'Cole Harbour, NS', tags: ['kids', 'trails'], website: 'https://coleharbourfarmmuseum.ca' }),
    place('item-oaklawnzoo', 'Oaklawn Farm Zoo', 'other', 45.0830, -64.6440, 'Family zoo with lions, tigers and many animals, Aylesford (~1.5 h).', { address: 'Aylesford, NS', tags: ['kids', 'daytrip'], website: 'https://oaklawnfarmzoo.ca' }),
    place('item-noggins', 'Noggins Corner Farm', 'other', 45.0960, -64.3370, 'U-pick, farm market, animals and play area near Wolfville.', { address: 'Greenwich, NS', tags: ['kids', 'daytrip'], website: 'https://nogginsfarm.ca' }),
    place('item-rossfarm', 'Ross Farm Museum', 'museum', 44.5760, -64.3380, 'Living 19th-century heritage farm with hands-on activities, New Ross (~1 h).', { address: 'New Ross, NS', tags: ['kids', 'daytrip'], website: 'https://rossfarm.novascotia.ca' }),

    // ---- Bigger day trips ----
    place('item-victoriapark', 'Victoria Park (Truro)', 'outdoor', 45.3580, -63.2700, 'Big park with gorge trails, waterfalls, splash-pad, pool and playground (~1 h).', { address: 'Truro, NS', tags: ['trails', 'kids', 'daytrip'], website: 'https://victoriaparktruro.ca' }),
    place('item-fundybore', 'Fundy Discovery Site', 'viewpoint', 45.3760, -63.2330, 'Tidal-bore viewing platform with playground and river trail, Truro.', { address: 'Truro, NS', tags: ['kids', 'daytrip', 'photos'] }),
    place('item-uniacke', 'Uniacke Estate Museum Park', 'museum', 44.9050, -63.8350, 'Georgian mansion with family trails and tea room, Mount Uniacke (~45 min).', { address: 'Mount Uniacke, NS', tags: ['trails', 'daytrip'], website: 'https://uniacke.novascotia.ca' }),
    place('item-sugarmoon', 'Sugar Moon Farm', 'restaurant', 45.5440, -63.0980, 'Maple farm + pancake house with sugar-camp tours and trails, Earltown (Fri–Sun).', { address: 'Earltown, NS', tags: ['kids', 'daytrip', 'trails'], website: 'https://sugarmoon.ca' }),

    // ---- More family restaurants ----
    place('item-saltash', 'Salt + Ash Beach House', 'restaurant', 44.6463, -63.5682, 'Waterfront live-fire spot — wood-fired pizza and East Coast fare.', { address: 'Queen’s Marque, Halifax', tags: ['walkable', 'tonight', 'photos'], website: 'https://saltashhalifax.com' }),
    place('item-boondocks', 'Boondocks', 'restaurant', 44.6360, -63.4720, "Casual seafood on the wharf at Fisherman's Cove, Eastern Passage.", { address: "Fisherman's Cove, Eastern Passage", tags: ['kids', 'photos'], website: 'https://boondocksdining.com' }),
    place('item-chabaa', 'Cha Baa Thai', 'restaurant', 44.6700, -63.5650, 'Reliable family Thai (Halifax, Dartmouth, Bedford).', { address: 'Dartmouth', tags: ['kids'], website: 'https://chabaathai.ca' }),
    place('item-cheesecurds', 'Cheese Curds Gourmet Burgers', 'restaurant', 44.6770, -63.5240, 'Gourmet burgers and poutine; kid-friendly, several HRM locations.', { address: 'Dartmouth', tags: ['kids'], website: 'https://cheesecurdsburgers.com' }),
    place('item-habaneros', 'Habaneros Modern Taco Bar', 'restaurant', 44.6420, -63.5780, 'Build-your-own tacos & burritos with veg/GF options.', { address: 'Halifax', tags: ['kids', 'walkable'] }),
    place('item-deedees', "Dee Dee's Ice Cream", 'restaurant', 44.6500, -63.5890, 'Small-batch handmade ice cream and sorbet, North End.', { address: 'North End, Halifax', tags: ['kids'], website: 'https://deedees.ca' }),
    place('item-propeller', 'Propeller Brewing', 'restaurant', 44.6510, -63.5900, 'Taproom with a basement pinball/arcade and house-made sodas for kids.', { address: 'Gottingen St, Halifax', tags: ['kids', 'rainy-day'], website: 'https://drinkpropeller.ca' }),

    // ---- More restaurants (broader coverage) ----
    place('item-bluenoseii', 'Bluenose II Restaurant', 'restaurant', 44.6452, -63.5715, 'Beloved Greek-Canadian diner on Hollis St (since 1964) — big menu, all-day breakfast.', { address: '1824 Hollis St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-lowerdeck', 'The Lower Deck', 'restaurant', 44.6489, -63.5697, 'Iconic Maritime pub with live East Coast music at Historic Properties.', { address: '1887 Upper Water St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-staynerswharf', "Stayner's Wharf", 'restaurant', 44.6483, -63.5688, 'Waterfront pub + live music, steps from the ferry.', { address: '5075 George St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-garrison', 'Garrison Brewing', 'restaurant', 44.6425, -63.5670, 'Seaport brewery taproom next to the farmers’ market.', { address: '1149 Marginal Rd, Halifax', tags: ['walkable'] }),
    place('item-amano', 'Ristorante a Mano', 'restaurant', 44.6452, -63.5686, 'Bishop’s Landing Italian on the boardwalk — pasta + wood-fired pizza.', { address: '1477 Lower Water St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-damaurizio', 'Da Maurizio', 'restaurant', 44.6447, -63.5740, 'Upscale Italian in the historic Brewery Market.', { address: '1496 Lower Water St, Halifax', tags: ['walkable'] }),
    place('item-cheelin', 'Cheelin', 'restaurant', 44.6447, -63.5742, 'Long-loved Chinese restaurant in the Brewery Market.', { address: '1496 Lower Water St, Halifax', tags: ['walkable'] }),
    place('item-highwayman', 'Highwayman', 'restaurant', 44.6478, -63.5732, 'Spanish-style tapas + sherry on Argyle St.', { address: '1714 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-antojo', 'Antojo Tacos & Tequila', 'restaurant', 44.6480, -63.5730, 'Lively Mexican on the Argyle St strip.', { address: '1667 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-athens', 'The Athens', 'restaurant', 44.6470, -63.5990, 'Family Greek restaurant on Quinpool Rd.', { address: '6273 Quinpool Rd, Halifax', tags: ['kids'] }),
    place('item-agricola', 'Agricola Street Brasserie', 'restaurant', 44.6575, -63.5930, 'North-End brasserie — brunch and bistro fare.', { address: '2540 Agricola St, Halifax' }),
    place('item-salvatores', "Salvatore's Pizzaiolo", 'restaurant', 44.6610, -63.6010, 'Authentic thin-crust pizza in the Hydrostone.', { address: '5541 Young St, Halifax', tags: ['kids'] }),
    place('item-armview', 'The Armview', 'restaurant', 44.6360, -63.6080, 'Retro diner-meets-bistro by the Armdale Rotary.', { address: '7156 Chebucto Rd, Halifax', tags: ['kids'] }),
    place('item-ardmore', 'Ardmore Tea Room', 'restaurant', 44.6470, -63.6010, 'Classic no-frills breakfast/lunch diner on Quinpool.', { address: '6499 Quinpool Rd, Halifax', tags: ['kids'] }),
    place('item-cabincoffee', 'Cabin Coffee', 'restaurant', 44.6455, -63.5720, 'Cozy local coffee + breakfast near the waterfront.', { address: '1554 Hollis St, Halifax', tags: ['walkable'] }),
    place('item-brightwood', 'Brightwood Brewery', 'restaurant', 44.6672, -63.5688, 'Neighbourhood Dartmouth brewery taproom, near the ferry.', { address: '64 Portland St, Dartmouth', tags: ['walkable'] }),

    // ==== From local guides (Discover Halifax / Tourism NS / Atlas Obscura) ====

    // ---- Breweries, cafés & bakeries ----
    place('item-keiths', "Alexander Keith's Brewery", 'restaurant', 44.6447, -63.5715, '200-year-old brewery on Lower Water St — a costumed tour ends with samples (lemonade for kids) and live trad music at the Stag’s Head pub.', { address: '1496 Lower Water St, Halifax', tags: ['walkable', 'tonight'], website: 'https://keiths.ca' }),
    place('item-goodrobot', 'Good Robot Brewing', 'restaurant', 44.6555, -63.5905, 'Quirky North-End brewery with a garden patio, brunch and bar bites.', { address: '2736 Robie St, Halifax', tags: ['kids'], website: 'https://goodrobotbrewing.ca' }),
    place('item-2crows', '2 Crows Brewing', 'restaurant', 44.6470, -63.5760, 'Downtown craft brewery known for hazy and mixed-fermentation beers.', { address: '1932 Brunswick St, Halifax', tags: ['walkable'], website: 'https://2crowsbrewing.com' }),
    place('item-offtrack', 'Off Track Brewing', 'restaurant', 44.6520, -63.5880, 'Small-batch neighbourhood brewery taproom in the North End.', { address: 'Almon St, Halifax' }),
    place('item-lucyshydrostone', "Lucy's Hydrostone Café", 'restaurant', 44.6612, -63.6012, 'North-End bakery-café (formerly Julien’s) — croissants, sourdough and coffee.', { address: '5517 Young St, Halifax', tags: ['kids'] }),
    place('item-lfbakery', 'LF Bakery', 'restaurant', 44.6505, -63.5905, 'Award-winning bakery — some of the best croissants in the city, North End.', { address: '2063 Gottingen St, Halifax', tags: ['kids'] }),
    place('item-frenchfix', 'Le French Fix Pâtisserie', 'restaurant', 44.6490, -63.5685, 'Authentic French pastries and macarons near the waterfront.', { address: '1592 Hollis St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-uncommongrounds', 'Uncommon Grounds', 'restaurant', 44.6420, -63.5790, 'Beloved local coffee house on Spring Garden Rd.', { address: '1030 South Park St, Halifax', tags: ['walkable', 'kids'] }),

    // ---- Live music, theatre & indoor fun ----
    place('item-carleton', 'The Carleton', 'activity', 44.6460, -63.5735, "One of Atlantic Canada's premier live-music rooms — dinner and a show downtown.", { address: '1685 Argyle St, Halifax', tags: ['walkable'], website: 'https://thecarleton.ca' }),
    place('item-seahorse', 'The Seahorse Tavern', 'activity', 44.6470, -63.5905, 'Long-running North-End live-music and DJ venue (with The Marquee & The Local).', { address: '2037 Gottingen St, Halifax' }),
    place('item-neptune', 'Neptune Theatre', 'activity', 44.6470, -63.5728, "Halifax's largest professional theatre — plays and family holiday shows downtown.", { address: '1593 Argyle St, Halifax', tags: ['walkable'], website: 'https://neptunetheatre.com' }),
    place('item-busstop', 'Bus Stop Theatre', 'activity', 44.6555, -63.5900, 'Intimate North-End indie theatre and performance space.', { address: '2203 Gottingen St, Halifax' }),
    place('item-halimacaxe', 'HaliMac Axe Throwing', 'activity', 44.6500, -63.5790, 'Family-friendly axe throwing (ages 10+) on Brunswick St.', { address: '1920 Brunswick St, Halifax', tags: ['rainy-day', 'kids'], website: 'https://halimacaxethrowing.com' }),
    place('item-puttingedge', 'Putting Edge', 'activity', 44.6770, -63.5240, 'Glow-in-the-dark indoor mini-golf plus an arcade, Dartmouth Crossing.', { address: 'Dartmouth Crossing', tags: ['rainy-day', 'kids'], website: 'https://puttingedge.com' }),

    // ---- Landmarks, lighthouses & big-nature day trips ----
    place('item-sambrolighthouse', 'Sambro Island Lighthouse', 'viewpoint', 44.4350, -63.5500, 'The oldest operating lighthouse in the Americas (1758) — view from Sambro village or up close on a boat tour.', { address: 'Sambro, NS', tags: ['daytrip', 'photos'] }),
    place('item-burntcoat', 'Burntcoat Head Park', 'viewpoint', 45.3050, -63.8120, "Home of the world's highest tides — walk the ocean floor at low tide (check the tide table). ~1.5 h via the Bay of Fundy.", { address: 'Noel, NS', tags: ['daytrip', 'kids', 'photos'], website: 'https://burntcoatheadpark.ca' }),
    place('item-mcnabs', 'McNabs Island', 'outdoor', 44.6180, -63.5350, 'Big harbour island with trails, beaches, an old fort and picnic spots — seasonal passenger ferry from Eastern Passage.', { address: 'Halifax Harbour', tags: ['daytrip', 'trails', 'kids'] }),
    place('item-fairviewcemetery', 'Fairview Lawn Cemetery (Titanic graves)', 'landmark', 44.6620, -63.6190, 'Resting place of 121 Titanic victims — a quiet, moving North-End stop.', { address: '3720 Windsor St, Halifax' }),
    place('item-beatyaquarium', 'Beaty Centre for Marine Biodiversity', 'museum', 44.6360, -63.5870, "Halifax's first public aquarium (opened 2026) at Dalhousie — local marine life and touch exhibits.", { address: '1355 Oxford St, Halifax', tags: ['kids', 'rainy-day'] }),

    // ==== From the kids' tourism magazine (Build Nova Scotia) ====

    // ---- Downtown Dartmouth (kid-friendly) ----
    place('item-backtothesea', 'The Back to the Sea Centre', 'museum', 44.6652, -63.5690, 'Hands-on marine centre near the ferry — touch tanks of local crabs, lobster and sea stars, all released back to the ocean each fall.', { address: 'Alderney Dr, Dartmouth', tags: ['walkable', 'kids', 'rainy-day'], website: 'https://backtothesea.org' }),
    place('item-alderneylanding', 'Alderney Landing', 'shopping', 44.6660, -63.5668, 'Ferry-terminal complex on the Dartmouth waterfront — farmers’ market, theatre, public library and a waterfront plaza.', { address: '2 Ochterloney St, Dartmouth', tags: ['walkable', 'kids'], website: 'https://alderneylanding.com' }),
    place('item-kiwanisplayground', 'Kiwanis Playground at Ferry Terminal Park', 'playground', 44.6638, -63.5650, 'Waterfront playground beside the Dartmouth ferry — rope climbing, carousel and harbour views.', { address: 'Ferry Terminal Park, Dartmouth', tags: ['walkable', 'kids'] }),
    place('item-dartmouthcommon', 'Dartmouth Common', 'outdoor', 44.6705, -63.5745, 'Big central green with a skatepark, splash pad, ball fields and playground.', { address: 'Dartmouth Common, Dartmouth', tags: ['kids'] }),
    place('item-lakebanook', 'Lake Banook', 'outdoor', 44.6735, -63.5680, 'Calm paddling lake with beaches and walking paths — host of national canoe/kayak races.', { address: 'Dartmouth', tags: ['kids', 'photos'] }),
    place('item-evergreenhouse', 'Evergreen House (Dartmouth Heritage Museum)', 'museum', 44.6690, -63.5728, 'Victorian house museum telling Dartmouth’s story.', { address: '26 Newcastle St, Dartmouth', tags: ['rainy-day'], website: 'https://dartmouthheritagemuseum.ns.ca' }),
    place('item-quakerhouse', 'Quaker House', 'museum', 44.6678, -63.5712, 'Restored 1786 Quaker whaler’s house — the oldest house in Dartmouth.', { address: '57 Ochterloney St, Dartmouth', tags: ['walkable'] }),
    place('item-zatzman', 'Zatzman Sportsplex', 'activity', 44.6728, -63.5732, 'Dartmouth rec complex — pools, waterslide, gym and arena; a solid rainy-day option.', { address: '110 Wyse Rd, Dartmouth', tags: ['kids', 'rainy-day'], website: 'https://zatzmansportsplex.com' }),
    place('item-portlandcreperie', 'Portland Street Crêperie', 'restaurant', 44.6668, -63.5708, 'Sweet and savoury crêpes (and bubble-waffle cones) on Portland St, Dartmouth.', { address: '55 Portland St, Dartmouth', tags: ['kids'] }),
    place('item-twoifbysea', 'Two If By Sea Café', 'restaurant', 44.6664, -63.5702, 'Beloved café famous for giant croissants and great coffee, downtown Dartmouth.', { address: '66 Ochterloney St, Dartmouth', tags: ['walkable'] }),
    place('item-yeahyeahs', "Yeah Yeah's Pizza", 'restaurant', 44.6660, -63.5700, 'Wood-fired pizza joint in downtown Dartmouth.', { address: 'Portland St, Dartmouth', tags: ['kids'] }),
    place('item-stonepizza', 'Stone Pizza', 'restaurant', 44.6657, -63.5682, 'Brick-oven pizza near the Dartmouth waterfront.', { address: 'Alderney Dr, Dartmouth', tags: ['walkable', 'kids'] }),
    place('item-josicecream', "Jo's Old Time Candy & Ice Cream Parlour", 'restaurant', 44.6700, -63.4785, 'Old-fashioned ice cream, candy and doughnuts, Cole Harbour.', { address: 'Cole Harbour, NS', tags: ['kids'] }),

    // ---- Halifax Waterfront landmarks ----
    place('item-thewave', 'The Wave Sculpture', 'landmark', 44.6458, -63.5685, 'The big curling concrete wave on the boardwalk — kids love climbing it (carefully!).', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids', 'photos'] }),
    place('item-submarineplayground', 'Submarine Playground', 'playground', 44.6486, -63.5676, 'Submarine-themed waterfront playground with rope climbers — accessible and right on the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-hammocks', 'Waterfront Hammocks', 'outdoor', 44.6481, -63.5681, 'The free orange hammocks strung along the boardwalk — perfect for a rest.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-drunkenlampposts', 'Drunken Lampposts', 'landmark', 44.6492, -63.5668, 'A cluster of deliberately tilted lampposts — a quirky boardwalk photo stop.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'photos'] }),
    place('item-artmural', 'Art Mural Wall', 'landmark', 44.6500, -63.5662, 'Colourful rotating mural wall along the north end of the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'photos'] }),
    place('item-saltyard', 'Salt Yard Shops', 'shopping', 44.6497, -63.5662, 'Shipping-container shops and snack stops on the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-obstaclecourse', 'Waterfront Obstacle Course', 'playground', 44.6483, -63.5673, 'Free outdoor obstacle/play course on the boardwalk for burning off energy.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-cssacadia', 'CSS Acadia', 'museum', 44.6466, -63.5690, 'Steam-powered survey ship you can board, moored beside the Maritime Museum.', { address: '1675 Lower Water St, Halifax', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-brewerymarket', 'Halifax Brewery Farmers’ Market', 'shopping', 44.6447, -63.5740, 'Saturday market in the historic Keith’s brewery building — food, makers and music.', { address: '1496 Lower Water St, Halifax', tags: ['walkable'], website: 'https://halifaxbrewerymarket.com' }),

    // ---- Halifax Waterfront treats ----
    place('item-blackbearicecream', 'Black Bear Ice Cream', 'restaurant', 44.6474, -63.5683, 'Small-batch homemade ice cream on the Halifax waterfront.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-fogcompany', 'The Fog Company', 'restaurant', 44.6471, -63.5685, 'Imaginative ice cream, cotton candy and doughnuts on the waterfront.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-peacebychocolate', 'Peace by Chocolate', 'restaurant', 44.6478, -63.5685, 'Chocolate from the celebrated Syrian-Canadian family business — waterfront kiosk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'], website: 'https://peacebychocolate.ca' }),
    place('item-rousseau', 'Rousseau Chocolatier', 'restaurant', 44.6462, -63.5720, 'Hand-made chocolates and rich hot chocolate, downtown Halifax.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-taiyaki', 'Taiyaki 52', 'restaurant', 44.6466, -63.5732, 'Soft-serve in a crunchy fish-shaped waffle cone, downtown Halifax.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-paneecirco', 'Pane e Circo', 'restaurant', 44.6461, -63.5740, 'Bubble waffles and housemade gelato, downtown Halifax.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-dairybar', 'The Dairy Bar', 'restaurant', 44.6452, -63.5752, 'Soft-serve and sundaes made with seasonal local ingredients, downtown Halifax.', { address: 'Halifax', tags: ['kids'] }),
    place('item-lemonadegeneral', 'Lemonade General Store', 'restaurant', 44.6552, -63.5908, 'Small-batch ice cream and treats, North End Halifax.', { address: 'North End, Halifax', tags: ['kids'] }),
    place('item-flynns', "Flynn's Dairy Bar & Convenience", 'restaurant', 44.6555, -63.5895, 'Tons of flavours of milkshakes, sundaes and scoops, North End Halifax.', { address: 'North End, Halifax', tags: ['kids'] }),

    // ---- Halifax Waterfront tours & rentals ----
    place('item-ambassatours', 'Ambassatours Tall Ship Silva', 'activity', 44.6470, -63.5688, 'Harbour sailing tours aboard the tall ship Silva from the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'], website: 'https://ambassatours.com' }),
    place('item-iheartbikes', 'I Heart Bikes', 'activity', 44.6463, -63.5689, 'Bike and e-bike rentals plus guided tours on the waterfront.', { address: 'Halifax Waterfront', tags: ['walkable'], website: 'https://iheartbikeshfx.com' }),
    place('item-jfarwell', 'J. Farwell Sailing Tours', 'activity', 44.6470, -63.5687, 'Small-group harbour sailing adventures from the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-segway', 'Segway Nova Scotia', 'activity', 44.6475, -63.5688, 'Guided Segway tours of the waterfront and downtown.', { address: 'Halifax Waterfront', tags: ['walkable'] }),
    place('item-cityharbourcruises', 'City & Harbour Cruises', 'activity', 44.6469, -63.5689, 'Sightseeing boat cruises of Halifax Harbour.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),

    // ---- Kid-friendly restaurants (HRM-wide) ----
    place('item-chickenburger', 'The Chickenburger', 'restaurant', 44.7282, -63.6618, 'Retro 1940s burger-and-shake joint in Bedford — a Nova Scotia institution.', { address: '1531 Bedford Hwy, Bedford', tags: ['kids'], website: 'https://thechickenburger.com' }),
    place('item-chknchop', 'CHKN CHOP', 'restaurant', 44.6560, -63.5910, 'Charcoal chicken joint with freshly baked cookies and mac n’ cheese, North End.', { address: 'North End, Halifax', tags: ['kids'] }),
    place('item-cheekyneighbour', 'Cheeky Neighbour Diner', 'restaurant', 44.6450, -63.6080, 'Modern neighbourhood diner — all-day breakfast and rotating local beers, West End.', { address: 'West End, Halifax', tags: ['kids'] }),
    place('item-easystreetdiner', 'Easy Street Diner', 'restaurant', 44.7700, -63.6880, 'Retro family diner with all-day breakfast, Bedford-Sackville.', { address: 'Sackville, NS', tags: ['kids'] }),
    place('item-localjo', 'Local Jo Café & Market', 'restaurant', 44.6445, -63.6055, 'Neighbourhood café with a play area and fair-trade coffee, West End.', { address: 'West End, Halifax', tags: ['kids'] }),
    place('item-gooddaykitchen', 'Good Day Kitchen & Café', 'restaurant', 44.8390, -63.5090, 'Family-run café near the airport — “babycinos”, baked goods and breakfast.', { address: 'Goffs, NS', tags: ['kids'] }),
    place('item-freemans', "Freeman's Little New York", 'restaurant', 44.6512, -63.5950, 'New-York-style pizza with kids’ menu and booths; several HRM locations.', { address: 'Halifax', tags: ['kids'], website: 'https://freemans.ca' }),
    place('item-ojetsushi', 'Ojet Sushi (Sushi Jet)', 'restaurant', 44.6470, -63.5742, 'All-you-can-eat sushi where robots help deliver the food — a hit with kids.', { address: 'Halifax', tags: ['kids', 'walkable'] }),
    place('item-micmacbar', 'Mic Mac Bar & Grill', 'restaurant', 44.6905, -63.5780, 'Long-running Dartmouth family restaurant with a big menu.', { address: 'Dartmouth', tags: ['kids'] }),
    place('item-vernons', "Vernon's Thunderbird Diner", 'restaurant', 44.7750, -63.6850, 'Retro family diner — sundaes, banana splits and all-day breakfast, Bedford-Sackville.', { address: 'Sackville, NS', tags: ['kids'] }),

    // ---- Ice cream worth a drive ----
    place('item-bubbamagoos', 'Bubba Magoos', 'restaurant', 44.4920, -63.9160, "Maritime-made ice cream and savoury snacks near Peggy's Cove.", { address: "Peggy's Cove area, NS", tags: ['kids', 'daytrip'] }),
    place('item-cavicchis', "Cavicchi's Meats", 'restaurant', 44.5000, -63.9050, "Small-batch ice cream from a takeout window with a patio, near St. Margaret's Bay.", { address: "St. Margaret's Bay, NS", tags: ['kids', 'daytrip'] }),
    place('item-thelittleicecream', 'The Little Ice Cream Shop', 'restaurant', 44.4950, -63.9150, "Soft-serve, sundaes and vegan options near Peggy's Cove.", { address: "Peggy's Cove area, NS", tags: ['kids', 'daytrip'] }),
    place('item-boozaemessa', 'Booza Emessa', 'restaurant', 44.7300, -63.6600, 'Small-batch Syrian ice cream, Bedford-Sackville.', { address: 'Sackville, NS', tags: ['kids'] }),
    place('item-chickenlittle', 'Chicken Little Café', 'restaurant', 44.7350, -63.6650, 'Kid-sized scoops and ice cream hurricanes, Bedford-Sackville.', { address: 'Sackville, NS', tags: ['kids'] }),
    place('item-bettervibe', 'Better Vibe', 'restaurant', 44.6450, -63.3450, 'Small-batch ice cream made with local ingredients, Eastern Shore.', { address: 'Eastern Shore, NS', tags: ['kids', 'daytrip'] }),

    // ---- Outdoors, hikes & heritage ----
    place('item-africville', 'Africville Park & Museum', 'museum', 44.6678, -63.6092, 'National Historic Site with a short waterfront trail and a museum telling the story of Halifax’s historic Black community.', { address: '5795 Africville Rd, Halifax', tags: ['trails', 'walkable'], website: 'https://africvillemuseum.org' }),
    place('item-taylorhead', 'Taylor Head Provincial Park', 'beach', 44.8130, -62.5700, 'White-sand beach and rugged coastal trails on the Eastern Shore (~1.5 h).', { address: 'Spry Bay, NS', tags: ['beach', 'trails', 'daytrip'], website: 'https://parks.novascotia.ca/park/taylor-head' }),
    place('item-ataraxyfarm', 'Ataraxy Farm', 'outdoor', 44.7000, -63.2000, 'Therapy goat farm on the Eastern Shore — free tours and playtime with the goats.', { address: 'Eastern Shore, NS', tags: ['kids', 'daytrip'] }),
    place('item-memorylane', 'Memory Lane Heritage Village', 'museum', 44.7900, -62.9000, '1940s living-history village on the Eastern Shore — schoolhouse, general store and a working cookhouse.', { address: 'Lake Charlotte, NS', tags: ['kids', 'daytrip'], website: 'https://heritagevillage.ca' }),

    // ---- Must-play playgrounds ----
    place('item-dewolf', 'DeWolf Park Playground', 'playground', 44.7245, -63.6585, 'Waterfront playground on the Bedford waterfront with a boardwalk and picnic area.', { address: 'Bedford', tags: ['kids'] }),
    place('item-fortneedham', 'Fort Needham Memorial Park', 'outdoor', 44.6620, -63.6020, 'North-End hilltop park with a playground and the Halifax Explosion memorial bell tower.', { address: 'Fort Needham, Halifax', tags: ['kids', 'photos'] }),
    place('item-isleville', 'Isleville Playground', 'playground', 44.6582, -63.5952, 'North-End playground with interactive games, a tube slide and a splash pad.', { address: 'North End, Halifax', tags: ['kids'] }),
    place('item-jumpstart', 'Jumpstart Inclusive Playground', 'playground', 44.6572, -63.5980, 'Fully accessible playground at George Dixon Centre — barrier-free ramps and braille lettering, North End.', { address: 'George Dixon Centre, Halifax', tags: ['kids'] }),
    place('item-westmount', 'Westmount Inclusive Playground', 'playground', 44.6430, -63.6100, 'Accessible West-End playground with tactile and audible features and a splash pad.', { address: 'West End, Halifax', tags: ['kids'] }),
    place('item-grandlakeoakfield', 'Grand Lake Oakfield Playground', 'playground', 44.9000, -63.5000, 'Tree-house-style playground with sports fields by Grand Lake (~25 min north).', { address: 'Oakfield, NS', tags: ['kids', 'daytrip'] }),

    // ---- Pools & splash pads ----
    place('item-canadagames', 'Canada Games Centre', 'activity', 44.6530, -63.6450, 'Big indoor aquatic + fitness centre with a leisure pool and slides, Clayton Park.', { address: '26 Thomas Raddall Dr, Halifax', tags: ['kids', 'rainy-day'], website: 'https://canadagamescentre.ca' }),
    place('item-captainspry', 'Captain William Spry Community Centre', 'activity', 44.6200, -63.6300, 'Spryfield rec centre with a wave pool, slide and climbing wall.', { address: '10 Kidston Rd, Halifax', tags: ['kids', 'rainy-day'] }),
    place('item-coleharbourplace', 'Cole Harbour Place', 'activity', 44.6700, -63.4750, 'Pool, arena and indoor playground in Cole Harbour.', { address: '51 Forest Hills Pkwy, Dartmouth', tags: ['kids', 'rainy-day'], website: 'https://coleharbourplace.com' }),
    place('item-sackvillesports', 'Sackville Sports Stadium', 'activity', 44.7700, -63.6900, 'Pool with a small slide and mushroom shower, plus arena and gym, Lower Sackville.', { address: '409 Glendale Ave, Lower Sackville', tags: ['kids', 'rainy-day'] }),
    place('item-halifaxcommonpool', 'Halifax Common Aquatic Facility', 'activity', 44.6478, -63.5828, 'New outdoor pool on the Halifax Common — beach-style entry, water plaza and toddler wading pool.', { address: 'Halifax Common', tags: ['kids'] }),
    place('item-shirleyssplash', "Shirley's Splash Pad", 'playground', 44.6760, -63.5680, 'Popular Dartmouth splash pad for hot summer days.', { address: 'Dartmouth', tags: ['kids'] }),

    // ---- Best family beach (drive) ----
    place('item-hubbards', 'Hubbards Beach', 'beach', 44.6320, -64.0820, 'Sandy beach with a floating dock and nearby canteen, ~45 min from Halifax.', { address: 'Hubbards, NS', tags: ['beach', 'kids', 'daytrip'] }),

    // ---- Kid nature adventures (Halifax Public Libraries) ----
    place('item-frogpond', 'Frog Pond', 'outdoor', 44.6288, -63.6100, 'Easy, mostly-flat loop around a pond in Sir Sandford Fleming Park — rock formations to clamber and ducks to watch; ~20 min for adults, up to an hour for toddlers.', { address: 'Dingle Rd, Halifax', tags: ['trails', 'kids', 'stroller-friendly'] }),
    place('item-hemlockravine', 'Hemlock Ravine Park', 'outdoor', 44.7058, -63.6510, 'Shady mature-forest trails off the Bedford Highway leading to the heart-shaped pond built by Prince Edward — cool on hot days, easy gravel paths.', { address: 'Kent Ave, Halifax', tags: ['trails', 'kids'] }),
    place('item-saltmarsh', 'Salt Marsh Trail', 'outdoor', 44.6520, -63.4470, 'Flat former-rail trail across the Cole Harbour salt marsh — birds, water views and turtles; part of the Trans Canada Trail.', { address: 'Bissett Rd, Cole Harbour', tags: ['trails', 'kids', 'stroller-friendly'] }),

    // ---- More Halifax restaurants (community favourites) ----
    place('item-studioeast', 'Studio East Food + Drink', 'restaurant', 44.6470, -63.5990, 'Inventive pan-Asian small plates on Quinpool — a local favourite.', { address: '6021 Cunard St, Halifax', tags: ['kids'] }),
    place('item-coastalcafe', 'The Coastal Café', 'restaurant', 44.6585, -63.5965, 'Beloved all-day brunch institution in the North End.', { address: '2731 Robie St, Halifax', tags: ['kids'] }),
    place('item-cardinal', 'Cardinal', 'restaurant', 44.6600, -63.6000, 'Creative brunch and dinner spot in the North End.', { address: '5670 Cornwallis St, Halifax' }),
    place('item-ostrichclub', 'Ostrich Club', 'restaurant', 44.6555, -63.5900, 'Acclaimed wood-fired North-End restaurant and natural-wine bar.', { address: '2454 Agricola St, Halifax' }),
    place('item-lionbright', 'Lion & Bright', 'restaurant', 44.6575, -63.5930, 'Café by day, wine bar by night on Agricola St.', { address: '2534 Agricola St, Halifax', tags: ['kids'] }),
    place('item-glitterbean', 'Glitter Bean Café', 'restaurant', 44.6440, -63.5800, 'Worker-owned coffee bar just off Spring Garden Rd.', { address: '5896 Spring Garden Rd, Halifax', tags: ['walkable', 'kids'] }),
    place('item-elagreek', 'Ela! Greek Taverna', 'restaurant', 44.6472, -63.5720, 'Modern Greek small plates downtown.', { address: '1565 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-mappatura', 'Mappatura Bistro', 'restaurant', 44.6478, -63.5735, 'Fresh handmade pasta and Italian plates downtown.', { address: '5883 Spring Garden Rd, Halifax', tags: ['walkable'] }),
    place('item-auctionhouse', 'The Auction House', 'restaurant', 44.6483, -63.5728, 'Argyle St restaurant and live-music venue.', { address: '1726 Argyle St, Halifax', tags: ['walkable'] }),

    // ---- From r/halifax recommendations ----
    place('item-oxalis', 'Oxalis', 'restaurant', 44.6668, -63.5700, 'Natural-wine bar and seasonal small plates in downtown Dartmouth.', { address: 'Portland St, Dartmouth', tags: ['walkable'] }),
    place('item-doraku', 'Doraku', 'restaurant', 44.6665, -63.5688, 'Sushi a short ferry ride + 5-min walk away in Dartmouth.', { address: 'Dartmouth', tags: ['walkable'] }),
    place('item-tribute', 'Tribute', 'restaurant', 44.6625, -63.5665, "Refined à la carte fine dining — named to Canada's 100 Best, Dartmouth.", { address: "King's Wharf, Dartmouth", tags: ['walkable'] }),
    place('item-mystic', 'Mystic', 'restaurant', 44.6552, -63.5905, "Multi-course tasting-menu fine dining — named to Canada's 100 Best.", { address: 'North End, Halifax' }),
    place('item-evans', "Evan's Fresh Seafood", 'restaurant', 44.6658, -63.5674, 'Great fish & chips right off the Dartmouth ferry.', { address: 'Alderney Dr, Dartmouth', tags: ['walkable', 'kids'] }),
    place('item-rudyolives', 'Rudy & Olives', 'restaurant', 44.7450, -63.6750, 'Clams, fish & chips and Newfoundland fries with dressing, Bedford-Sackville.', { address: 'Sackville, NS', tags: ['kids'] }),
    place('item-turkuaz', 'Turkuaz Grill', 'restaurant', 44.7270, -63.6610, 'Turkish grill — kebabs and mezze, Bedford / Bayers Lake.', { address: 'Bedford, NS', tags: ['kids'] }),

    // ---- From Tripadvisor family restaurants ----
    place('item-fredies', "Fredie's Fantastic Fishhouse", 'restaurant', 44.6452, -63.5795, 'Quick-bite seafood spot famous for huge lobster rolls and chowder.', { address: 'Halifax', tags: ['kids'] }),
    place('item-tomavinos', 'Tomavinos Ristorante', 'restaurant', 44.7150, -63.6600, 'Italian and pizza with a big wine list, Bedford.', { address: 'Bedford, NS', tags: ['kids'] }),
    place('item-lebistro', 'Le Bistro By Liz', 'restaurant', 44.6470, -63.5722, 'French-European bistro downtown — flat-crust pizzas, lamb shank, weekend brunch.', { address: 'Halifax', tags: ['walkable'] }),
    place('item-talaythai', 'Talay Thai', 'restaurant', 44.6470, -63.6000, 'Well-loved Thai curries and classics.', { address: 'Halifax', tags: ['kids'] }),
    place('item-claytonpark', 'Clayton Park Bar & Grill', 'restaurant', 44.6530, -63.6450, 'Friendly neighbourhood bar & grill, Clayton Park.', { address: 'Halifax', tags: ['kids'] }),
    place('item-batonrouge', 'Bâton Rouge Grillhouse & Bar', 'restaurant', 44.6486, -63.5760, 'Ribs, steak and big plates downtown.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-piatto', 'Piatto Pizzeria', 'restaurant', 44.6456, -63.5742, 'Neapolitan wood-fired pizza downtown.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-keg', 'The Keg Steakhouse + Bar', 'restaurant', 44.6480, -63.5720, 'Classic steakhouse downtown.', { address: 'Halifax', tags: ['walkable'] }),
    place('item-orient', 'The Orient Chinese Cuisine', 'restaurant', 44.6470, -63.5990, 'Well-reviewed Chinese restaurant.', { address: 'Halifax', tags: ['kids'] }),
    place('item-cora', 'Cora Breakfast & Lunch', 'restaurant', 44.6500, -63.6100, 'Big fruit-topped breakfasts and brunch — very kid-friendly.', { address: 'Halifax', tags: ['kids'] }),
    place('item-tako', 'Tako Sushi & Ramen', 'restaurant', 44.6465, -63.5730, 'Japanese sushi and ramen downtown.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-harbourstone', 'Harbourstone', 'restaurant', 44.6490, -63.5690, 'Waterfront hotel restaurant — chowder, lobster roll, nachos.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-moxies', 'Moxies', 'restaurant', 44.6482, -63.5756, 'Family-friendly North American chain — broad menu.', { address: 'Halifax', tags: ['kids'] }),

    // ---- More Tripadvisor family restaurants ----
    place('item-verano', 'Verano Food Purveyors', 'restaurant', 44.6560, -63.5908, 'Family-run Mexican-Canadian spot — fresh, healthy plates.', { address: 'Halifax', tags: ['kids'] }),
    place('item-goldenfortune', 'Golden Fortune', 'restaurant', 44.6470, -63.5995, 'Good-value Chinese on Quinpool.', { address: 'Quinpool Rd, Halifax', tags: ['kids'] }),
    place('item-shuck', 'Shuck Seafood + Raw Bar', 'restaurant', 44.6452, -63.5685, 'Oysters, seafood and steak at Bishop’s Landing on the waterfront.', { address: "Bishop's Landing, Halifax", tags: ['walkable', 'tonight'] }),
    place('item-indochine', 'Indochine Banh Mi', 'restaurant', 44.6440, -63.5775, 'Vietnamese banh mi, pho and rice bowls near South Park.', { address: 'South Park St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-togofresh', 'To Go Fast Fresh Food', 'restaurant', 44.6475, -63.5740, 'Quick, healthy bowls and soups downtown.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-mychaplate', 'My Cha & Plate', 'restaurant', 44.6435, -63.5800, 'Cafe for tea, coffee and noodles near the Public Gardens.', { address: 'Spring Garden, Halifax', tags: ['walkable', 'kids'] }),
    place('item-aromalatino', 'Cafe Aroma Latino', 'restaurant', 44.6500, -63.5900, 'Mexican-Latin cafe — churros, tapaditos and shakes.', { address: 'Halifax', tags: ['kids'] }),
    place('item-trident', 'Trident Booksellers & Cafe', 'restaurant', 44.6460, -63.5745, 'Cozy bookstore cafe with great coffee and tea, downtown.', { address: '1256 Hollis St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-lionshead', "The Lion's Head Tavern", 'restaurant', 44.6600, -63.6010, 'Neighbourhood North-End tavern — wings, fish & chips.', { address: 'Halifax' }),
    place('item-fiveguys', 'Five Guys', 'restaurant', 44.6478, -63.5745, 'Build-your-own burgers and fresh-cut fries.', { address: 'Halifax', tags: ['kids'] }),
    place('item-cosysnack', 'Cosy Snack Bar', 'restaurant', 44.6500, -63.5950, 'Tiny, beloved old-school “greasy spoon” diner.', { address: 'Halifax', tags: ['kids'] }),
    place('item-javablend', 'Java Blend Coffee Roasters', 'restaurant', 44.6560, -63.5930, 'North-End coffee roaster and cafe.', { address: 'North End, Halifax', tags: ['kids'] }),
    place('item-ilovepho', 'I Love Pho', 'restaurant', 44.6470, -63.5985, 'Vietnamese pho and noodle bowls on Quinpool.', { address: 'Quinpool Rd, Halifax', tags: ['kids'] }),
    place('item-graftontheatre', 'Grafton Street Dinner Theatre', 'activity', 44.6478, -63.5735, 'Live musical-comedy show with a three-course meal downtown.', { address: '1741 Grafton St, Halifax', tags: ['walkable'] }),
    place('item-pgscafe', "PG's Cafe and Grill", 'restaurant', 44.6455, -63.5715, 'No-frills counter-service diner on Hollis St.', { address: 'Hollis St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-mercantile', 'The Mercantile Social', 'restaurant', 44.6470, -63.5725, 'Globally-inspired small plates and seafood downtown.', { address: 'Halifax', tags: ['walkable'] }),
    place('item-staranise', 'Star Anise', 'restaurant', 44.6500, -63.5880, 'Vietnamese pho and rice bowls.', { address: 'Halifax', tags: ['kids'] }),
    place('item-marthaspizza', "Martha's Pizza II", 'restaurant', 44.6440, -63.5760, 'Pizza, donairs, panzerotti and fish & chips, Morris St.', { address: 'Morris St, Halifax', tags: ['kids'] }),
    place('item-layers', 'Layers Cupcakes', 'restaurant', 44.6550, -63.5905, 'Fresh-baked cupcakes and treats.', { address: 'Halifax', tags: ['kids'] }),
    place('item-boardroom', 'The Board Room Game Cafe', 'activity', 44.6465, -63.5740, 'Board-game cafe — play hundreds of games over food and drinks.', { address: '1256 Barrington St, Halifax', tags: ['walkable', 'kids', 'rainy-day'] }),
    place('item-kebabkitchen', 'Kebab Kitchen', 'restaurant', 44.6485, -63.5735, 'Mediterranean kebabs and mezze in Scotia Square.', { address: 'Scotia Square, Halifax', tags: ['walkable', 'kids'] }),
    place('item-fongsing', 'Fong Sing', 'restaurant', 44.6530, -63.6440, 'Long-running Chinese near Clayton Park.', { address: 'Clayton Park, Halifax', tags: ['kids'] }),
    place('item-busan', 'Busan Korean BBQ', 'restaurant', 44.6470, -63.5760, 'Cook-at-your-table Korean BBQ downtown.', { address: 'Halifax', tags: ['kids'] }),
    place('item-johnnyk', "Johnny K's Authentic Donairs", 'restaurant', 44.6460, -63.5740, 'Halifax donairs by Pizza Corner.', { address: 'Blowers St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-newwingwah', 'New Wing Wah', 'restaurant', 44.6490, -63.6000, 'Generous-portion Chinese lunch specials.', { address: 'Halifax', tags: ['kids'] }),
    place('item-bostonpizza', 'Boston Pizza', 'restaurant', 44.6485, -63.5760, 'Family pizza-and-pasta chain with a big kids’ menu.', { address: 'Halifax', tags: ['kids'] }),
    place('item-dillpickle', 'The Dill Pickle', 'restaurant', 44.6500, -63.5900, 'Salads, sandwiches and quick bites.', { address: 'Halifax', tags: ['kids'] }),
    place('item-loong7', 'Loong7', 'restaurant', 44.6560, -63.5950, 'Fresh North-End Chinese — chow mein and vermicelli.', { address: 'North End, Halifax', tags: ['kids'] }),
    place('item-sushinami', "Sushi Nami Royale (Bayers Lake)", 'restaurant', 44.6450, -63.6490, 'Sushi and maki in Bayers Lake.', { address: 'Bayers Lake, Halifax', tags: ['kids'] }),
    place('item-gingerbreadhaus', 'Gingerbread Haus Bakery', 'restaurant', 44.6440, -63.5710, 'European breads, pastries and cakes near the port.', { address: 'Hollis St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-weirdharbour', 'Weird Harbour Espresso Bar', 'restaurant', 44.6455, -63.5735, 'Small Barrington St espresso bar.', { address: 'Barrington St, Halifax', tags: ['walkable'] }),
    place('item-tonysdonair', "Tony's Donair", 'restaurant', 44.6470, -63.5970, 'Big-value donairs and poutine.', { address: 'Halifax', tags: ['kids'] }),
    place('item-birdsnest', "Bird's Nest Cafe", 'restaurant', 44.6500, -63.5850, 'Cafe with great snacks, sandwiches and baked goods.', { address: 'Halifax', tags: ['kids'] }),
    place('item-katch', 'Katch', 'restaurant', 44.6475, -63.5683, 'Crispy haddock fish & chips kiosk on the waterfront boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-marbleslab', 'Marble Slab Creamery', 'restaurant', 44.6470, -63.5760, 'Custom mix-in ice cream on fresh waffle cones.', { address: 'Halifax', tags: ['kids'] }),
    place('item-armdaleyacht', 'Armdale Yacht Club', 'restaurant', 44.6350, -63.6100, 'Seafood and water views at the Armdale Yacht Club.', { address: 'Armdale, Halifax', tags: ['photos'] }),
    place('item-willys', "Willy's", 'restaurant', 44.6500, -63.5950, 'Burgers and killer poutine.', { address: 'Halifax', tags: ['kids'] }),
    place('item-tasteofindia', 'A Taste of India', 'restaurant', 44.6485, -63.5735, 'Indian fast food in the Scotia Square food court.', { address: 'Scotia Square, Halifax', tags: ['walkable', 'kids'] }),
    place('item-songs', "Song's Korean", 'restaurant', 44.6470, -63.5990, 'Korean soups, BBQ and specialties.', { address: 'Halifax', tags: ['kids'] }),
    place('item-lookhoho', 'Look Ho Ho', 'restaurant', 44.6480, -63.5760, 'Reasonably-priced classic Chinese, downtown.', { address: 'Halifax', tags: ['kids'] }),
    place('item-rays', "Ray's Lebanese Cuisine", 'restaurant', 44.6500, -63.5900, 'Falafel, shawarma and skewers.', { address: 'Halifax', tags: ['kids'] }),
    place('item-worldtea', 'World Tea House', 'restaurant', 44.6470, -63.5735, 'Relaxing tea house with a huge tea selection, Argyle St.', { address: 'Argyle St, Halifax', tags: ['walkable'] }),
    place('item-pickfordblack', 'Pickford & Black', 'restaurant', 44.6490, -63.5688, 'Waterfront bar & seafood at the Marriott Harbourfront.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-stationsix', 'Station Six', 'restaurant', 44.6470, -63.5760, 'Pub fare — Nashville chicken, burgers, pan-fried haddock.', { address: 'Halifax', tags: ['kids'] }),
    place('item-qiubrothers', 'Qiu Brothers Dumplings', 'restaurant', 44.6470, -63.5760, 'Hand-made dumplings and wonton soup.', { address: 'Halifax', tags: ['kids'] }),
    place('item-kodoraku', 'Ko-Doraku', 'restaurant', 44.6470, -63.5980, 'Japanese sushi, soba and combos.', { address: 'Halifax', tags: ['kids'] }),
    place('item-xenas', "Xena's Bread and Butter", 'restaurant', 44.6550, -63.5905, 'Filipino bakery — breakfast, coffee and pastries.', { address: 'Halifax', tags: ['kids'] }),
    place('item-sevenbays', 'Seven Bays Bouldering', 'activity', 44.6555, -63.5950, 'Indoor bouldering gym with a great cafe — climbing for all ages.', { address: '2019 Gottingen St, Halifax', tags: ['kids', 'rainy-day'] }),
    place('item-ladyhammond', 'Lady Hammond Bar & Grill', 'restaurant', 44.6620, -63.6080, 'North-End diner and grill.', { address: 'North End, Halifax', tags: ['kids'] }),
    place('item-arisu', 'Arisu Table BBQ and Sushi Bar', 'restaurant', 44.6470, -63.5760, 'All-you-can-eat Korean BBQ and sushi.', { address: 'Halifax', tags: ['kids'] }),
    place('item-saltyardsocial', 'Salt Yard Social', 'restaurant', 44.6498, -63.5662, 'Hand-tossed pizza, mussels and cocktails on the boardwalk.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-shiraz', 'Shiraz', 'restaurant', 44.6470, -63.5770, 'Persian kebabs and stews — a Maritime favourite.', { address: 'Halifax', tags: ['kids'] }),
    place('item-narrowespresso', 'Narrow Espresso', 'restaurant', 44.6540, -63.5905, 'Tiny North-End espresso bar.', { address: 'Gottingen St, Halifax', tags: ['walkable'] }),
    place('item-randyspizza', "Randy's Pizza & Donair", 'restaurant', 44.6500, -63.6000, 'Quick pizza, garlic fingers and donairs.', { address: 'Halifax', tags: ['kids'] }),
    place('item-canvas', 'Canvas Resto-Lounge', 'restaurant', 44.6480, -63.5740, 'Bar and lounge — burgers, salads, brunch.', { address: 'Halifax', tags: ['walkable'] }),
    place('item-nowwerecookin', "Now We're Cookin", 'restaurant', 44.6700, -63.5700, 'Clams & chips and pizza in Dartmouth.', { address: 'Dartmouth', tags: ['kids'] }),
    place('item-junglejims', "Jungle Jim's", 'restaurant', 44.6700, -63.5750, 'Wacky family chain with a huge menu and a fun atmosphere.', { address: 'Dartmouth', tags: ['kids'] }),
    place('item-midtown', 'Midtown Tavern & Lounge', 'restaurant', 44.6478, -63.5740, 'Classic Halifax tavern — steak, donairs, no fuss.', { address: 'Grafton St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-swisschalet', 'Swiss Chalet', 'restaurant', 44.6500, -63.6100, 'Rotisserie chicken and ribs — reliable family chain.', { address: 'Halifax', tags: ['kids'] }),
    place('item-mexis', "Mexi's", 'restaurant', 44.6470, -63.5990, 'Casual Mexican — fajitas and tacos.', { address: 'Halifax', tags: ['kids'] }),
    place('item-cousins', "Cousin's Restaurant", 'restaurant', 44.6500, -63.5950, 'Greek-diner comfort food with big servings.', { address: 'Halifax', tags: ['kids'] }),
    place('item-heartwood', 'Heartwood', 'restaurant', 44.6470, -63.5990, 'Long-running vegetarian/vegan kitchen.', { address: 'Quinpool Rd, Halifax', tags: ['kids'] }),
    place('item-redchillies', 'Redchillies Flavors of India', 'restaurant', 44.6500, -63.6000, 'Biryani, tandoori and curries.', { address: 'Halifax', tags: ['kids'] }),
    place('item-fungwah', 'Fung Wah', 'restaurant', 44.6500, -63.6010, 'Quick, affordable neighbourhood Chinese.', { address: 'Halifax', tags: ['kids'] }),
    place('item-pizzeriatomaso', 'Pizzeria Tomaso', 'restaurant', 44.7280, -63.6620, 'Thin-crust pizza with quality ingredients, Bedford.', { address: 'Bedford, NS', tags: ['kids'] }),
    place('item-acadianfishchips', 'Acadian Fish & Chips', 'restaurant', 44.7400, -63.7400, 'Classic fish & chips, Hammonds Plains.', { address: 'Hammonds Plains, NS', tags: ['kids'] }),
    place('item-budapest', 'Budapest Bisztro', 'restaurant', 44.6500, -63.5900, 'Hungarian schnitzel, goulash and langos.', { address: 'Halifax' }),
    place('item-rasa', 'Rasa: Flavours of India', 'restaurant', 44.6470, -63.5980, 'Northern Indian curries and tandoori.', { address: 'Halifax', tags: ['kids'] }),
    place('item-trulytasty', 'Truly Tasty', 'restaurant', 44.6500, -63.5950, 'Some of the best ramen in Nova Scotia.', { address: 'Halifax', tags: ['kids'] }),
    place('item-burritojax', 'Burrito Jax', 'restaurant', 44.6470, -63.5980, 'Build-your-own burritos and bowls.', { address: 'Halifax', tags: ['kids'] }),
    place('item-orso', 'Orso Pub and Grill', 'restaurant', 44.6478, -63.5765, 'Italian-leaning pub near the Scotiabank Centre.', { address: 'Halifax', tags: ['walkable'] }),
    place('item-pizzadelic', 'Pizzadelic', 'restaurant', 44.6470, -63.5980, 'Creative pizzas, quick bites.', { address: 'Halifax', tags: ['kids'] }),
    place('item-freshsushi', 'Fresh Happy Healthy Sushi', 'restaurant', 44.6500, -63.5950, 'All-you-can-eat sushi and sushi pizza.', { address: 'Halifax', tags: ['kids'] }),
    place('item-chinatown', 'China Town Restaurant', 'restaurant', 44.6490, -63.5990, 'Clean, bright Chinese with take-out.', { address: 'Halifax', tags: ['kids'] }),
    place('item-jennysplace', "Jenny's Place Lounge", 'restaurant', 44.6500, -63.6000, 'Friendly, well-priced neighbourhood lounge.', { address: 'Halifax', tags: ['kids'] }),
    place('item-bestchoice', 'Best Choice Chinese Food', 'restaurant', 44.6520, -63.6100, 'Big-portion Chinese take-out.', { address: 'Halifax', tags: ['kids'] }),
    place('item-hamachikita', 'Hamachi Kita', 'restaurant', 44.6610, -63.6010, 'Sushi in the Hydrostone, North End.', { address: 'Hydrostone, Halifax', tags: ['kids'] }),
    place('item-mezza', 'Mezza Lebanese Kitchen', 'restaurant', 44.6470, -63.5760, 'Fast Lebanese — shawarma, donairs and bowls.', { address: 'Halifax', tags: ['kids'] }),
    place('item-xtremepizza', 'Xtreme Pizza', 'restaurant', 44.6450, -63.5775, 'Quirky pizzas on Birmingham St downtown.', { address: 'Birmingham St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-snappytomato', 'Snappy Tomato Pizza', 'restaurant', 44.6500, -63.6000, 'Quick-bite pizza.', { address: 'Halifax', tags: ['kids'] }),
    place('item-simplyput', 'Simply Put Café', 'restaurant', 44.6450, -63.5690, 'Breakfast and waffles on Lower Water St.', { address: 'Lower Water St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-jeans', "Jean's Restaurant", 'restaurant', 44.6500, -63.5950, 'Chinese-Japanese — spicy beef, pad thai, egg rolls.', { address: 'Halifax', tags: ['kids'] }),
    place('item-lacucina', 'La Cucina Cafe Pizzeria', 'restaurant', 44.6500, -63.6000, 'Pizza, pasta and garlic fingers.', { address: 'Halifax', tags: ['kids'] }),
    place('item-pizzadelight', 'Pizza Delight', 'restaurant', 44.6520, -63.6100, 'Maritime pizza chain with a lunch buffet.', { address: 'Halifax', tags: ['kids'] }),
    place('item-swaadsagaa', 'Swaad Sagaa Indian Cuisine', 'restaurant', 44.6500, -63.6000, 'Indian fast-casual.', { address: 'Halifax', tags: ['kids'] }),
    place('item-dessertyard', 'Dessert Yard', 'restaurant', 44.6500, -63.5950, 'Milkshakes and over-the-top desserts.', { address: 'Halifax', tags: ['kids'] }),
    place('item-shengs', "Sheng's Chinese Restaurant", 'restaurant', 44.6500, -63.6010, 'Egg rolls and lunchtime Chinese.', { address: 'Halifax', tags: ['kids'] }),
    place('item-besharam', 'Besharam Bar and Grill', 'restaurant', 44.6480, -63.5760, 'Highly-rated Indian downtown.', { address: 'Halifax', tags: ['walkable', 'kids'] }),
    place('item-kickscafe', 'Kicks Cafe', 'restaurant', 44.6500, -63.5950, 'Casual American-Canadian cafe.', { address: 'Halifax', tags: ['kids'] }),

    // ---- Downtown Halifax attractions (Tripadvisor + guides) ----
    place('item-tattoo', 'Royal Nova Scotia International Tattoo', 'activity', 44.6486, -63.5762, 'Huge indoor summer spectacle — marching bands, acrobats, pipes & drums; kids free (early July).', { address: 'Scotiabank Centre, Halifax', tags: ['walkable', 'kids'], website: 'https://nstattoo.ca' }),
    place('item-scotiabankcentre', 'Scotiabank Centre', 'activity', 44.6486, -63.5765, 'Downtown arena for hockey, concerts and big events.', { address: '1800 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-splash', 'Splash 360° Dome', 'activity', 44.6463, -63.5690, 'Immersive 360° cinematic dome on the waterfront by the Maritime Museum.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-seaturtle', 'Sea Turtle Centre', 'museum', 44.6430, -63.5670, "Tiny science centre about Canada's leatherback sea turtles — quick and kid-friendly.", { address: 'Seaport, Halifax', tags: ['walkable', 'kids', 'rainy-day'] }),
    place('item-halifaxdistillery', 'Halifax Distillery Co.', 'restaurant', 44.6655, -63.5668, 'Craft rum distillery with a full bar/restaurant and daily tours.', { address: 'Dartmouth Waterfront', tags: ['walkable'] }),
    place('item-stmarys', "St. Mary's Cathedral Basilica", 'landmark', 44.6440, -63.5740, '1820s basilica with soaring stone and beautiful stained glass, near Spring Garden.', { address: '5221 Spring Garden Rd, Halifax', tags: ['walkable'] }),
    place('item-governmenthouse', 'Government House', 'landmark', 44.6450, -63.5755, 'Georgian residence of the Lieutenant Governor — summer tours.', { address: '1451 Barrington St, Halifax', tags: ['walkable'] }),
    place('item-sailorsalute', "Sailor's Salute Statue", 'landmark', 44.6452, -63.5680, 'The Sailor statue at Sackville Landing on the waterfront.', { address: 'Sackville Landing, Halifax', tags: ['walkable', 'tonight', 'photos'] }),
    place('item-harbourside', 'Harbourside Market', 'shopping', 44.6468, -63.5686, 'Local street/flea market on the waterfront — fresh produce and makers.', { address: 'Halifax Waterfront', tags: ['walkable'] }),
    place('item-victoriaparkhfx', 'Victoria Park (Halifax)', 'outdoor', 44.6420, -63.5775, 'Quiet downtown city park near Spring Garden Rd — fountains and benches.', { address: 'Spring Garden Rd, Halifax', tags: ['walkable'] }),
    place('item-zwickers', "Zwicker's Art Gallery", 'museum', 44.6470, -63.5720, 'Three floors of curated Canadian art downtown.', { address: '5415 Doyle St, Halifax', tags: ['walkable'] }),
    place('item-annaleonowens', 'Anna Leonowens Gallery', 'museum', 44.6460, -63.5740, 'NSCAD University gallery with rotating student and faculty shows.', { address: '1891 Granville St, Halifax', tags: ['walkable'] }),
    place('item-norberts', "Norbert's Good Food", 'restaurant', 44.6428, -63.5667, 'Farm-to-table restaurant inside the Seaport Farmers’ Market.', { address: '1209 Marginal Rd, Halifax', tags: ['walkable', 'kids'] }),
    place('item-princeofwales', 'Prince of Wales Tower', 'landmark', 44.6230, -63.5680, '1790s round defensive tower tucked in Point Pleasant Park.', { address: 'Point Pleasant Park, Halifax', tags: ['trails'] }),

    // ---- Downtown Halifax tours, activities & treats (Tripadvisor) ----
    place('item-capturedescape', 'Captured Escape Rooms', 'activity', 44.6470, -63.5740, 'Themed escape rooms with immersive puzzles — fun for families and teens.', { address: 'Halifax', tags: ['walkable', 'kids', 'rainy-day'], website: 'https://capturedescaperooms.com' }),
    place('item-cineplexparklane', 'Cineplex Cinemas Park Lane', 'activity', 44.6438, -63.5790, 'Downtown movie theatre at Park Lane on Spring Garden Rd.', { address: '5657 Spring Garden Rd, Halifax', tags: ['walkable', 'kids', 'rainy-day'] }),
    place('item-ghostwalk', 'The Halifax Ghost Walk', 'activity', 44.6478, -63.5766, 'Lantern-lit walking tour of ghost, pirate and devil tales through the old streets.', { address: 'Old Town Clock, Halifax', tags: ['walkable'], website: 'https://halifaxghostwalk.com' }),
    place('item-altroutes', 'Alternative Routes Day Tours', 'activity', 44.6470, -63.5685, 'Hop-on-hop-off shuttle to Peggy’s Cove, Mahone Bay, Lunenburg and the Valley in a day.', { address: 'Halifax Waterfront', tags: ['daytrip'] }),
    place('item-harbourtours', 'Halifax Harbour Tours', 'activity', 44.6470, -63.5687, '60-min guided harbour tour on a quiet all-electric 1930s-style launch.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight'] }),
    place('item-kayakhalifax', 'Kayak Halifax', 'activity', 44.6420, -63.5670, 'Two-hour guided harbour kayak tours from near downtown.', { address: 'Seaport, Halifax', tags: ['kids'] }),
    place('item-ridesolar', 'Ride Solar Pedal-Bus', 'activity', 44.6470, -63.5688, 'Solar-powered 18-seat pedal-bus tours of the city.', { address: 'Halifax Waterfront', tags: ['walkable'] }),
    place('item-rumrunners', 'Rum Runners Rum Cake Factory', 'restaurant', 44.6472, -63.5684, 'Waterfront bakery — famous rum cakes baked on site.', { address: 'Halifax Waterfront', tags: ['walkable', 'tonight', 'kids'] }),
    place('item-obladee', 'Obladee, a Wine Bar', 'restaurant', 44.6465, -63.5728, 'Cozy downtown wine bar with an eclectic list and small plates.', { address: '1600 Barrington St, Halifax', tags: ['walkable'] }),
    place('item-splitcrow', 'The Split Crow', 'restaurant', 44.6489, -63.5720, 'Lively maritime pub with live East Coast music — one of the oldest in town.', { address: '1855 Granville St, Halifax', tags: ['walkable', 'tonight'] }),
    place('item-economyshoe', 'Economy Shoe Shop Cafe & Bar', 'restaurant', 44.6483, -63.5733, 'Iconic, funky Argyle St bar-restaurant with a great patio.', { address: '1663 Argyle St, Halifax', tags: ['walkable'] }),
    place('item-sweetjanes', "Sweet Jane's", 'restaurant', 44.6460, -63.5705, 'Vintage candy, retro toys and gourmet treats on Queen St — a kid magnet.', { address: 'Queen St, Halifax', tags: ['walkable', 'kids'] }),
    place('item-amospewter', 'Amos Pewter', 'shopping', 44.6470, -63.5686, 'Waterfront pewter workshop — watch pieces being hand-cast.', { address: 'Halifax Waterfront', tags: ['walkable', 'kids'] }),

    // ---- South Shore: Lunenburg (novascotia.com) ----
    place('item-bluenoselunenburg', 'Bluenose II', 'activity', 44.3753, -64.3138, "Tour or sail Canada's famous racing schooner from its Lunenburg home port at the Fisheries Museum wharf (when she's in).", { address: 'Bluenose Dr, Lunenburg', tags: ['photos', 'daytrip', 'walkable'] }),
    place('item-ironworks', 'Ironworks Distillery', 'restaurant', 44.3758, -64.3082, 'Small-batch spirits in a historic blacksmith shop — tastings and a 45-min tour.', { address: '2 Kempt St, Lunenburg', tags: ['walkable'] }),
    place('item-bluerocks', 'Blue Rocks', 'viewpoint', 44.3570, -64.2700, 'Tiny working fishing village with blue-slate shores — classic Nova Scotia scenery and great kayaking.', { address: 'Blue Rocks, NS', tags: ['photos', 'daytrip'] }),
    place('item-pleasantpaddling', 'Pleasant Paddling', 'activity', 44.3575, -64.2710, 'Guided kayak & paddleboard tours and rentals around the Blue Rocks islands.', { address: 'Blue Rocks, NS', tags: ['kids', 'daytrip'] }),
    place('item-trotntime', 'Trot in Time', 'activity', 44.3762, -64.3110, 'Horse-and-buggy tour of Old Town Lunenburg from the waterfront — a kid favourite.', { address: 'Lunenburg Waterfront', tags: ['walkable', 'kids'] }),
    place('item-lunenburgocean', 'Lunenburg Ocean Adventures', 'activity', 44.3758, -64.3100, 'Scenic and lobster-fishing boat tours from the Lunenburg waterfront.', { address: 'Lunenburg Waterfront', tags: ['kids', 'photos', 'daytrip'] }),
    place('item-shipwright', 'Shipwright Brewing Co.', 'restaurant', 44.3770, -64.3072, 'Lunenburg craft brewery and taproom.', { address: 'Lunenburg', tags: ['walkable'] }),
    place('item-tinroof', 'Tin Roof Distillery', 'restaurant', 44.3765, -64.3076, 'Small-batch distillery on the Good Cheer Trail, Lunenburg.', { address: 'Lunenburg', tags: ['walkable'] }),
    place('item-lightship', 'Lightship Brewery', 'restaurant', 44.3768, -64.3060, 'Lunenburg microbrewery taproom.', { address: 'Lunenburg', tags: ['walkable'] }),
    place('item-grandbanker', 'The Grand Banker Bar & Grill', 'restaurant', 44.3760, -64.3090, 'Waterfront seafood — chowder, lobster and live music, Lunenburg.', { address: '82 Montague St, Lunenburg', tags: ['walkable', 'kids'] }),
    place('item-knotpub', 'The Knot Pub', 'restaurant', 44.3772, -64.3066, 'Cozy local pub — fish & chips and pints, Lunenburg.', { address: '4 Dufferin St, Lunenburg', tags: ['walkable'] }),

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
