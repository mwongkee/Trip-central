import { travelMinutes } from '@tripboard/shared';

/** Adaptive travel-time label from a centre: walk for near (≤30 min), drive beyond. */
export function travelLabel(
  center: { lat: number; lng: number } | null,
  lat?: number,
  lng?: number,
): string | null {
  if (!center || lat == null || lng == null) return null;
  const walk = travelMinutes(center.lat, center.lng, lat, lng, 'walk');
  if (walk < 1) return null;
  if (walk <= 30) return `~${Math.round(walk)} min 🚶`;
  return `~${Math.max(1, Math.round(travelMinutes(center.lat, center.lng, lat, lng, 'drive')))} min 🚗`;
}
