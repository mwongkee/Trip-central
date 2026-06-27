import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Item, Presence } from '@tripboard/shared';
import { colorForName, initials } from '../lib/avatar.js';

interface MapViewProps {
  items: Item[];
  selectedId: string | null;
  /** Highlight a pin (no scroll/jump) — the Board shows a bottom detail card. */
  onSelect: (itemId: string) => void;
  /** The user's shared location, shown as a "you are here" dot. */
  userLocation?: { lat: number; lng: number } | null;
  /** Family members currently sharing their location. */
  presences?: Presence[];
}

/** Free, no-key vector basemap. Override with VITE_MAP_STYLE (e.g. Amazon Location). */
const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const CATEGORY_COLORS: Record<string, string> = {
  outdoor: '#2f9e44',
  museum: '#1971c2',
  beach: '#0c8599',
  playground: '#f59f00',
  viewpoint: '#9c36b5',
  restaurant: '#e8590c',
  lodging: '#e64980',
  other: '#868e96',
};

function colorFor(item: Item): string {
  if (item.isAnchor) return '#f0b400';
  const key = item.type === 'MEAL' ? 'restaurant' : item.category ?? 'other';
  return CATEGORY_COLORS[key] ?? CATEGORY_COLORS['other']!;
}

function iconFor(item: Item): string {
  if (item.isAnchor) return item.anchorRole === 'hotel' ? '🏨' : '🏠';
  return item.type === 'MEAL' ? '🍽' : '📍';
}

export function MapView({ items, selectedId, onSelect, userLocation, presences }: MapViewProps) {
  const styleUrl = (import.meta.env.VITE_MAP_STYLE as string | undefined) || DEFAULT_STYLE;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const personMarkersRef = useRef<Marker[]>([]);
  const loadedRef = useRef(false);

  const located = items.filter((i) => typeof i.lat === 'number' && typeof i.lng === 'number');
  // Two stable signatures (located is a fresh array each render):
  // - boundsKey: only the set membership → fit-bounds keys off this (no refit on votes/selection).
  // - markersKey: includes vote score/status so marker badges & highlight refresh when votes change.
  const boundsKey = located.map((i) => i.itemId).join('|');
  const markersKey = located.map((i) => `${i.itemId}:${i.voteScore}:${i.voteCount}:${i.status}`).join('|');

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [-63.6, 44.5],
      zoom: 8,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');
    map.on('load', () => {
      loadedRef.current = true;
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [styleUrl]);

  // Render markers (rebuilds on selection to update the highlight; does NOT move the map).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = located.map((item) => {
      const voted = item.voteCount > 0;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `marker ${item.isAnchor ? 'marker--anchor' : ''} ${voted ? 'marker--voted' : ''} ${item.itemId === selectedId ? 'marker--sel' : ''}`;
      el.style.setProperty('--marker-color', colorFor(item));
      el.setAttribute('aria-label', voted ? `${item.title} — ${item.voteScore} votes` : item.title);
      el.textContent = iconFor(item);
      if (voted) {
        const badge = document.createElement('span');
        badge.className = 'marker__badge';
        badge.textContent = String(item.voteScore);
        el.appendChild(badge);
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(item.itemId); // highlight + Board shows a bottom detail card — map stays put
      });
      return new maplibregl.Marker({ element: el }).setLngLat([item.lng!, item.lat!]).addTo(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, selectedId, onSelect]);

  // Fit the map to the visible set only when that set changes (not on selection),
  // so tapping a pin keeps the map exactly where it is.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || located.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    located.forEach((i) => bounds.extend([i.lng!, i.lat!]));
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  // "You are here" marker + recenter when location is first shared.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'marker marker--me';
      el.setAttribute('aria-label', 'Your location');
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
      map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 });
    }
  }, [userLocation]);

  // Family members sharing their location → avatar markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    personMarkersRef.current.forEach((m) => m.remove());
    personMarkersRef.current = (presences ?? []).map((p) => {
      const el = document.createElement('div');
      el.className = 'marker marker--person';
      el.style.setProperty('--marker-color', colorForName(p.name));
      el.setAttribute('aria-label', `${p.name} is here`);
      el.title = `${p.name} (shared location)`;
      el.textContent = initials(p.name);
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });
  }, [presences]);

  return <div className="map" ref={containerRef} aria-label="Trip map" />;
}
