import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap, type Marker, type Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Item } from '@tripboard/shared';

interface MapViewProps {
  items: Item[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
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

export function MapView({ items, selectedId, onSelect }: MapViewProps) {
  const styleUrl = (import.meta.env.VITE_MAP_STYLE as string | undefined) || DEFAULT_STYLE;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  const loadedRef = useRef(false);

  const located = items.filter((i) => typeof i.lat === 'number' && typeof i.lng === 'number');

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
    popupRef.current = new maplibregl.Popup({ offset: 18, closeButton: true, maxWidth: '260px' });
    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [styleUrl]);

  // Render markers + fit bounds whenever the (filtered) set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = located.map((item) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `marker ${item.isAnchor ? 'marker--anchor' : ''} ${item.itemId === selectedId ? 'marker--sel' : ''}`;
      el.style.setProperty('--marker-color', colorFor(item));
      el.setAttribute('aria-label', item.title);
      el.textContent = iconFor(item);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(item.itemId);
        openPopup(map, item);
      });
      return new maplibregl.Marker({ element: el }).setLngLat([item.lng!, item.lat!]).addTo(map);
    });

    if (located.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      located.forEach((i) => bounds.extend([i.lng!, i.lat!]));
      map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 400 });
    }
  }, [located, selectedId, onSelect]);

  function openPopup(map: MlMap, item: Item) {
    const popup = popupRef.current;
    if (!popup) return;
    const el = document.createElement('div');
    el.className = 'mappop';
    const img = item.imageUrl
      ? `<img class="mappop__img" src="${item.imageUrl}" alt="" loading="lazy" onerror="this.style.display='none'"/>`
      : '';
    const cat = item.isAnchor ? item.anchorRole : item.type === 'MEAL' ? item.mealType : item.category;
    el.innerHTML = `
      ${img}
      <div class="mappop__body">
        <strong class="mappop__title">${escapeHtml(item.title)}</strong>
        <div class="mappop__meta">${escapeHtml(String(cat ?? ''))} · ★ ${item.voteScore}</div>
        ${item.address ? `<div class="mappop__addr">📌 ${escapeHtml(item.address)}</div>` : ''}
      </div>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mappop__btn';
    btn.textContent = 'Open details ›';
    btn.addEventListener('click', () => {
      onSelect(item.itemId);
      popup.remove();
    });
    el.appendChild(btn);
    popup.setLngLat([item.lng!, item.lat!]).setDOMContent(el).addTo(map);
  }

  return <div className="map" ref={containerRef} aria-label="Trip map" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
