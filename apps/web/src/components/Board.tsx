import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { familyVoters, haversineKm, type Item, type ItemType, type TripBundle } from '@tripboard/shared';
import { useApp } from '../lib/context.js';
import { ItemCard } from './ItemCard.js';
import { MapView } from './MapView.js';
import { AddItemForm } from './AddItemForm.js';
import { Itinerary } from './Itinerary.js';

type StatusFilter = 'all' | 'suggested' | 'scheduled' | 'done';
type TypeFilter = 'all' | ItemType;

export function Board({ bundle }: { bundle: TripBundle }) {
  const { identity } = useApp();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'board' | 'itinerary'>('board');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [kidMode, setKidMode] = useState(false);
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // The distance-search centre is either your location ("Near me") or the selected pin.
  const centerItem = useMemo(
    () => bundle.items.find((i) => i.itemId === selectedId) ?? null,
    [bundle.items, selectedId],
  );
  const center = useMemo<{ lat: number; lng: number; label: string } | null>(() => {
    if (nearMe && userLoc) return { lat: userLoc.lat, lng: userLoc.lng, label: 'you' };
    if (centerItem && typeof centerItem.lat === 'number' && typeof centerItem.lng === 'number') {
      return { lat: centerItem.lat, lng: centerItem.lng, label: centerItem.title };
    }
    return null;
  }, [nearMe, userLoc, centerItem]);
  const canRadius = !!center;

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Location is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        setRadiusKm((r) => r ?? 2);
        setGeoError(null);
      },
      () => setGeoError('Could not get your location — check location permissions.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Categories present in the trip, for the map/list filter chips.
  const categoryList = useMemo(() => {
    const s = new Set<string>();
    for (const i of bundle.items) if (i.category) s.add(i.category);
    return [...s].sort();
  }, [bundle.items]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  const family = useMemo(
    () => (identity ? familyVoters(identity.familyId, bundle.members, bundle.children) : []),
    [identity, bundle.members, bundle.children],
  );

  const fuse = useMemo(
    () =>
      new Fuse(bundle.items, {
        keys: ['title', 'description', 'tags', 'address'],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [bundle.items],
  );

  const filtered = useMemo(() => {
    let items: Item[] = query.trim() ? fuse.search(query.trim()).map((r) => r.item) : bundle.items;
    if (typeFilter !== 'all') items = items.filter((i) => i.type === typeFilter);
    if (statusFilter !== 'all') items = items.filter((i) => i.status === statusFilter);
    if (cats.size > 0) items = items.filter((i) => i.category && cats.has(i.category));
    if (tagFilter.size > 0) items = items.filter((i) => [...tagFilter].every((t) => i.tags.includes(t)));
    if (kidMode)
      items = items.filter(
        (i) =>
          i.tags.includes('kids') ||
          i.tags.includes('stroller-friendly') ||
          i.category === 'playground' ||
          i.category === 'beach',
      );
    if (radiusKm && center) {
      items = items.filter(
        (i) => i.lat != null && i.lng != null && haversineKm(center.lat, center.lng, i.lat, i.lng) <= radiusKm,
      );
    }
    // Anchors pinned to the top, then highest score first.
    return items.slice().sort((a, b) => {
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1;
      return b.voteScore - a.voteScore;
    });
  }, [query, fuse, bundle.items, typeFilter, statusFilter, cats, tagFilter, kidMode, radiusKm, center]);

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    cats.size +
    tagFilter.size +
    (kidMode ? 1 : 0) +
    (radiusKm ? 1 : 0);

  function clearAllFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
    setCats(new Set());
    setTagFilter(new Set());
    setKidMode(false);
    setRadiusKm(null);
    setNearMe(false);
  }

  // "Near the ferry": centre the distance search on the Halifax ferry terminal.
  function nearFerry() {
    const ferry =
      bundle.items.find((i) => i.itemId === 'item-hfxterminal') ??
      bundle.items.find((i) => i.tags.includes('ferry') && i.lat != null);
    if (!ferry) return;
    setNearMe(false);
    setSelectedId(ferry.itemId);
    setRadiusKm((r) => r ?? 2);
  }

  // Tapping a pin just highlights it (and sets the distance centre) — stays on the map.
  function highlight(itemId: string) {
    setSelectedId(itemId);
    setNearMe(false); // switch the distance centre to this pin
  }

  // From the popup's "Open details": expand the card and scroll the list to it.
  function select(itemId: string) {
    setSelectedId(itemId);
    setExpandedId(itemId);
    setTimeout(() => document.getElementById(`card-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  return (
    <div className="board">
      <div className="board__tabs" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'board'}
          className={`tab ${view === 'board' ? 'tab--on' : ''}`}
          onClick={() => setView('board')}
        >
          Board
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'itinerary'}
          className={`tab ${view === 'itinerary' ? 'tab--on' : ''}`}
          onClick={() => setView('itinerary')}
        >
          📅 Itinerary
        </button>
      </div>

      {view === 'itinerary' ? (
        <Itinerary items={bundle.items} onSelect={(id) => { setView('board'); select(id); }} />
      ) : (
        boardMain()
      )}
    </div>
  );

  function boardMain() {
    return (
      <>
      <div className="board__bar">
        <input
          type="search"
          className="board__search"
          placeholder="Search places, meals…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search trip items"
        />
        <button type="button" className="btn" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
          ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close' : '+'}
        </button>
      </div>

      <div className="board__presets" role="group" aria-label="Quick filters">
        <button type="button" className={`fchip ${nearMe ? 'fchip--on' : ''}`} aria-pressed={nearMe} onClick={useMyLocation}>📍 Near me</button>
        <button type="button" className="fchip" onClick={nearFerry}>⛴ Near ferry</button>
        <button type="button" className={`fchip ${kidMode ? 'fchip--on' : ''}`} aria-pressed={kidMode} onClick={() => setKidMode((v) => !v)}>🧒 Kids</button>
        <button type="button" className={`fchip ${tagFilter.has('tonight') ? 'fchip--on' : ''}`} aria-pressed={tagFilter.has('tonight')} onClick={() => toggle(tagFilter, setTagFilter, 'tonight')}>🌙 Tonight</button>
        <button type="button" className={`fchip ${tagFilter.has('walkable') ? 'fchip--on' : ''}`} aria-pressed={tagFilter.has('walkable')} onClick={() => toggle(tagFilter, setTagFilter, 'walkable')}>🚶 Walkable</button>
        {activeFilterCount > 0 && (
          <button type="button" className="fchip fchip--clear" onClick={clearAllFilters}>clear ✕</button>
        )}
      </div>

      {canRadius && (
        <div className="board__radius" role="group" aria-label="Distance">
          <span className="board__radiuslabel">within</span>
          {[1, 2, 5, 10].map((km) => (
            <button key={km} type="button" className={`fchip ${radiusKm === km ? 'fchip--on' : ''}`} aria-pressed={radiusKm === km} onClick={() => setRadiusKm(radiusKm === km ? null : km)}>
              {km} km
            </button>
          ))}
          <span className="board__radiuslabel">of <strong>{center!.label}</strong></span>
        </div>
      )}
      {geoError && <p className="join__error" role="alert">{geoError}</p>}

      {adding && <AddItemForm onDone={() => setAdding(false)} />}

      <aside className="board__map" aria-label="Map">
        <MapView items={filtered} selectedId={selectedId} userLocation={userLoc} onSelect={highlight} onOpenDetails={select} />
        <p className="board__maphint">{filtered.length} place{filtered.length === 1 ? '' : 's'} shown · tap a pin for details</p>
      </aside>

      <section className="board__list" aria-label="Trip items">
        {filtered.map((item) => {
          const distanceKm =
            radiusKm && center && item.lat != null && item.lng != null
              ? haversineKm(center.lat, center.lng, item.lat, item.lng)
              : null;
          return (
            <ItemCard
              key={item.itemId}
              item={item}
              family={family}
              distanceKm={distanceKm}
              expanded={expandedId === item.itemId}
              selected={selectedId === item.itemId}
              onToggle={() => setExpandedId((cur) => (cur === item.itemId ? null : item.itemId))}
            />
          );
        })}
        {filtered.length === 0 && <p className="board__empty">Nothing matches. Try a different search or suggest something.</p>}
      </section>

      {filtersOpen && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Filters" onClick={() => setFiltersOpen(false)}>
          <div className="sheet__card" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <h2>Filters</h2>
              <button type="button" className="btn btn--ghost" onClick={() => setFiltersOpen(false)} aria-label="Close filters">✕</button>
            </div>

            <label className="sheet__label" htmlFor="f-type">Type</label>
            <select id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
              <option value="all">All types</option>
              <option value="PLACE">Places</option>
              <option value="MEAL">Meals</option>
            </select>

            <label className="sheet__label" htmlFor="f-status">Status</label>
            <select id="f-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">Any status</option>
              <option value="suggested">Suggested</option>
              <option value="scheduled">Scheduled</option>
              <option value="done">Done</option>
            </select>

            <span className="sheet__label">Category</span>
            <div className="sheet__chips">
              {categoryList.map((c) => (
                <button key={c} type="button" className={`fchip ${cats.has(c) ? 'fchip--on' : ''}`} aria-pressed={cats.has(c)} onClick={() => toggle(cats, setCats, c)}>
                  {c}
                </button>
              ))}
            </div>

            <div className="sheet__foot">
              <button type="button" className="btn" onClick={clearAllFilters}>Clear all</button>
              <button type="button" className="btn btn--primary" onClick={() => setFiltersOpen(false)}>Show {filtered.length} places</button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  }
}
