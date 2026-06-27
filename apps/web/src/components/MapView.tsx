import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Item } from '@tripboard/shared';

interface MapViewProps {
  items: Item[];
  selectedId: string | null;
  onSelect: (itemId: string) => void;
}

/**
 * Interactive map of located items. Reads a full MapLibre style URL from
 * VITE_MAP_STYLE. With Amazon Location you'd build that style URL + sign tile
 * requests via Identity-Pool creds (transformRequest) — see PLAN.md M1/M5.
 * If no style is configured, we fall back to an accessible list so nothing breaks.
 */
export function MapView({ items, selectedId, onSelect }: MapViewProps) {
  const styleUrl = import.meta.env.VITE_MAP_STYLE as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  const located = items.filter((i) => typeof i.lat === 'number' && typeof i.lng === 'number');

  useEffect(() => {
    if (!styleUrl || !containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [-63.57, 44.65],
      zoom: 9,
    });
    map.addControl(new maplibregl.NavigationControl({}), 'top-right');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [styleUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = located.map((item) => {
      const el = document.createElement('button');
      el.className = `marker ${item.isAnchor ? 'marker--anchor' : ''} ${item.itemId === selectedId ? 'marker--sel' : ''}`;
      el.type = 'button';
      el.setAttribute('aria-label', item.title);
      el.textContent = item.isAnchor ? '★' : item.type === 'MEAL' ? '🍽' : '📍';
      el.addEventListener('click', () => onSelect(item.itemId));
      return new maplibregl.Marker({ element: el }).setLngLat([item.lng!, item.lat!]).addTo(map);
    });
  }, [located, selectedId, onSelect]);

  if (!styleUrl) {
    return (
      <div className="map map--fallback" role="img" aria-label="Map preview (not configured)">
        <p className="map__note">
          Map style not configured. Set <code>VITE_MAP_STYLE</code> to enable the interactive map.
        </p>
        <ul className="map__list">
          {located.map((i) => (
            <li key={i.itemId}>
              <button
                type="button"
                className={`map__pin ${i.itemId === selectedId ? 'map__pin--sel' : ''}`}
                onClick={() => onSelect(i.itemId)}
              >
                <span aria-hidden="true">{i.isAnchor ? '★' : i.type === 'MEAL' ? '🍽' : '📍'}</span> {i.title}
              </button>
            </li>
          ))}
          {located.length === 0 && <li>No located items yet.</li>}
        </ul>
      </div>
    );
  }

  return <div className="map" ref={containerRef} aria-label="Trip map" />;
}
