import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MlMap, type Marker, type GeoJSONSource } from 'maplibre-gl';
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

export function MapView({ items, selectedId, onSelect, userLocation, presences }: MapViewProps) {
  const styleUrl = (import.meta.env.VITE_MAP_STYLE as string | undefined) || DEFAULT_STYLE;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const personMarkersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [styleReady, setStyleReady] = useState(false);

  const located = items.filter((i) => typeof i.lat === 'number' && typeof i.lng === 'number');
  const boundsKey = located.map((i) => i.itemId).join('|');
  const markersKey = located.map((i) => `${i.itemId}:${i.voteScore}:${i.voteCount}`).join('|');

  function featureCollection(): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: located.map((i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [i.lng!, i.lat!] },
        properties: {
          id: i.itemId,
          color: colorFor(i),
          voted: i.voteCount > 0,
          selected: i.itemId === selectedId,
        },
      })),
    };
  }

  // Init the map + clustered source/layers once.
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
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('items', { type: 'geojson', data: featureCollection(), cluster: true, clusterMaxZoom: 13, clusterRadius: 45 });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'items',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1f6feb',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 30, 28],
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'items',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'pin',
        type: 'circle',
        source: 'items',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'selected'], 11, 8],
          'circle-stroke-width': ['case', ['get', 'selected'], 4, ['case', ['get', 'voted'], 3, 2]],
          'circle-stroke-color': ['case', ['get', 'selected'], '#58a6ff', ['case', ['get', 'voted'], '#f0c000', '#ffffff']],
        },
      });

      map.on('click', 'clusters', (e) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
        if (!f) return;
        const clusterId = f.properties?.['cluster_id'] as number;
        const src = map.getSource('items') as GeoJSONSource;
        void src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          map.easeTo({ center: coords, zoom });
        });
      });
      map.on('click', 'pin', (e) => {
        const id = e.features?.[0]?.properties?.['id'] as string | undefined;
        if (id) onSelectRef.current(id);
      });
      for (const layer of ['clusters', 'pin']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }

      setStyleReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, [styleUrl]);

  // Update source data when the visible set, votes, or selection change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const src = map.getSource('items') as GeoJSONSource | undefined;
    src?.setData(featureCollection());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleReady, markersKey, selectedId]);

  // Fit to the visible set only when membership changes (not on votes/selection).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || located.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    located.forEach((i) => bounds.extend([i.lng!, i.lat!]));
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  // "You are here" dot + recenter when location is first shared.
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
      userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map);
      map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: Math.max(map.getZoom(), 13), duration: 500 });
    }
  }, [userLocation]);

  // Family members sharing location → avatar markers.
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
