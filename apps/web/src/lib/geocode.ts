import type { Category } from '@tripboard/shared';

export interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: Category;
}

const valid = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Pull coordinates out of a pasted Google Maps URL (or a bare "lat, lng").
 * Handles the full-URL forms (@lat,lng and !3d..!4d.. and ?q=lat,lng). Short
 * share links (maps.app.goo.gl) can't be resolved in the browser → returns null.
 */
export function parseGoogleMapsCoords(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const pats = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // /place/.../@44.64,-63.56,17z
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/, // data=...!3d44.64!4d-63.56
    /[?&](?:q|query|ll|daddr|destination|center)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i,
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/, // bare "44.64, -63.56"
  ];
  for (const p of pats) {
    const m = input.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

function mapCategory(cls: string, type: string): Category | undefined {
  if (cls === 'amenity' && ['restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'bakery', 'ice_cream', 'food_court'].includes(type)) return 'restaurant';
  if (cls === 'shop') return 'shopping';
  if (cls === 'historic') return 'landmark';
  if (cls === 'tourism' && ['museum', 'gallery', 'aquarium'].includes(type)) return 'museum';
  if (cls === 'tourism' && ['viewpoint', 'attraction', 'artwork'].includes(type)) return 'viewpoint';
  if (cls === 'tourism' && ['hotel', 'motel', 'guest_house', 'hostel', 'apartment', 'chalet'].includes(type)) return 'lodging';
  if (cls === 'leisure' && type === 'playground') return 'playground';
  if (cls === 'leisure' && ['park', 'garden', 'nature_reserve', 'common'].includes(type)) return 'outdoor';
  if (cls === 'natural' && ['beach', 'bay', 'coastline'].includes(type)) return 'beach';
  if (cls === 'leisure' || cls === 'sport') return 'activity';
  return undefined;
}

/**
 * Free-text place search via OpenStreetMap's Nominatim geocoder (no key; runs in
 * the browser). Biased to Nova Scotia. Returns up to 6 candidates to add.
 */
export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const q = /nova scotia|halifax|dartmouth|\bns\b/i.test(query) ? query : `${query}, Nova Scotia`;
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=ca&q=' +
    encodeURIComponent(q);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const rows = (await res.json()) as Array<{
    lat: string;
    lon: string;
    name?: string;
    display_name: string;
    category?: string;
    class?: string;
    type: string;
  }>;
  return rows
    .map((r): GeoResult | null => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (!valid(lat, lng)) return null;
      const name = r.name?.trim() || r.display_name.split(',')[0]!.trim();
      return { name, address: r.display_name, lat, lng, category: mapCategory(r.class ?? r.category ?? '', r.type) };
    })
    .filter((r): r is GeoResult => r !== null);
}
