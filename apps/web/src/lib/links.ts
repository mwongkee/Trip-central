import type { Item } from '@tripboard/shared';

/**
 * A universal Google Maps link that opens in the Maps app on phones and the web
 * elsewhere. Prefers a name+address search (so it's findable/searchable), falling
 * back to coordinates, then the bare title.
 */
export function mapsLink(item: Item): string {
  const byText = [item.title, item.address].filter(Boolean).join(', ');
  const query = byText || (item.lat != null && item.lng != null ? `${item.lat},${item.lng}` : item.title);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
