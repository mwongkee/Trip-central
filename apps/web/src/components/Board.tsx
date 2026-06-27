import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { familyVoters, travelMinutes, type Item, type ItemType, type TripBundle, type TravelMode } from '@tripboard/shared';
import { useApp } from '../lib/context.js';
import { ItemCard } from './ItemCard.js';
import { MapView } from './MapView.js';
import { AddItemForm } from './AddItemForm.js';
import { Itinerary } from './Itinerary.js';
import { usePresence, useItemDetail } from '../hooks/queries.js';
import { useLocationShare } from '../hooks/useLocationShare.js';
import { mapsLink } from '../lib/links.js';
import { Avatar } from './Avatar.js';

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
  const [foodMode, setFoodMode] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null); // cents; null = any
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [radiusMin, setRadiusMin] = useState<number | null>(null); // minutes of travel; null = off
  const [travelMode, setTravelMode] = useState<TravelMode>('walk');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  const focusOn = (lat: number, lng: number) => setFocus({ lat, lng, nonce: Date.now() });

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
        setRadiusMin((r) => r ?? 15);
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

  const presenceQ = usePresence();
  const share = useLocationShare();
  const presences = presenceQ.data ?? [];
  const peekDetail = useItemDetail(selectedId);
  const peekVotes = peekDetail.data?.votes ?? [];

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
    if (foodMode) items = items.filter((i) => i.type === 'MEAL' || i.category === 'restaurant');
    if (maxPrice != null) items = items.filter((i) => (i.estCost ?? 0) <= maxPrice);
    if (radiusMin && center) {
      items = items.filter(
        (i) => i.lat != null && i.lng != null && travelMinutes(center.lat, center.lng, i.lat, i.lng, travelMode) <= radiusMin,
      );
    }
    // Anchors pinned to the top, then highest score first.
    return items.slice().sort((a, b) => {
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1;
      return b.voteScore - a.voteScore;
    });
  }, [query, fuse, bundle.items, typeFilter, statusFilter, cats, tagFilter, kidMode, foodMode, maxPrice, radiusMin, travelMode, center]);

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    cats.size +
    tagFilter.size +
    (kidMode ? 1 : 0) +
    (foodMode ? 1 : 0) +
    (maxPrice != null ? 1 : 0) +
    (radiusMin ? 1 : 0);

  function clearAllFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
    setCats(new Set());
    setTagFilter(new Set());
    setKidMode(false);
    setFoodMode(false);
    setMaxPrice(null);
    setRadiusMin(null);
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
    setRadiusMin((r) => r ?? 15);
    if (ferry.lat != null && ferry.lng != null) focusOn(ferry.lat, ferry.lng);
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

      {(query.trim() || activeFilterCount > 0) && (
        <p className="board__results" aria-live="polite">
          <strong>{filtered.length}</strong> result{filtered.length === 1 ? '' : 's'}
          {query.trim() ? ` for “${query.trim()}”` : ''} · shown on the map
          {filtered.length > 0 && filtered.filter((i) => i.lat != null).length < filtered.length &&
            ` (${filtered.filter((i) => i.lat != null).length} on map)`}
          {query.trim() && (
            <button type="button" className="linkbtn" onClick={() => setQuery('')}>clear</button>
          )}
        </p>
      )}

      {query.trim() && filtered.length > 0 && (
        <ul className="searchresults" aria-label="Search results">
          {filtered.slice(0, 8).map((item) => (
            <li key={item.itemId}>
              <button
                type="button"
                className="searchresults__item"
                onClick={() => {
                  highlight(item.itemId);
                  if (item.lat != null && item.lng != null) focusOn(item.lat, item.lng);
                }}
              >
                <span className="searchresults__name">{item.title}</span>
                <span className="searchresults__meta">
                  {item.type === 'MEAL' ? '🍽' : '📍'} {item.category ?? item.mealType ?? ''}
                  {item.address ? ` · ${item.address}` : ''}
                </span>
              </button>
            </li>
          ))}
          {filtered.length > 8 && <li className="searchresults__more">+{filtered.length - 8} more in the list below</li>}
        </ul>
      )}

      <div className="board__presets" role="group" aria-label="Quick filters">
        <button type="button" className={`fchip ${nearMe ? 'fchip--on' : ''}`} aria-pressed={nearMe} onClick={useMyLocation}>📍 Near me</button>
        <button type="button" className="fchip" onClick={nearFerry}>⛴ Near ferry</button>
        <button type="button" className={`fchip ${foodMode ? 'fchip--on' : ''}`} aria-pressed={foodMode} onClick={() => setFoodMode((v) => !v)}>🍴 Food</button>
        <button type="button" className={`fchip ${kidMode ? 'fchip--on' : ''}`} aria-pressed={kidMode} onClick={() => setKidMode((v) => !v)}>🧒 Kids</button>
        <button type="button" className={`fchip ${tagFilter.has('tonight') ? 'fchip--on' : ''}`} aria-pressed={tagFilter.has('tonight')} onClick={() => toggle(tagFilter, setTagFilter, 'tonight')}>🌙 Tonight</button>
        <button type="button" className={`fchip ${tagFilter.has('walkable') ? 'fchip--on' : ''}`} aria-pressed={tagFilter.has('walkable')} onClick={() => toggle(tagFilter, setTagFilter, 'walkable')}>🚶 Walkable</button>
        <button type="button" className={`fchip ${share.sharing ? 'fchip--on' : ''}`} aria-pressed={share.sharing} onClick={share.toggle}>
          📡 {share.sharing ? 'Sharing…' : 'Share location'}
        </button>
        {activeFilterCount > 0 && (
          <button type="button" className="fchip fchip--clear" onClick={clearAllFilters}>clear ✕</button>
        )}
      </div>

      {canRadius && (
        <div className="board__radius" role="group" aria-label="Travel-time distance">
          <button
            type="button"
            className="fchip"
            onClick={() => setTravelMode(travelMode === 'walk' ? 'drive' : 'walk')}
            aria-label={`Switch to ${travelMode === 'walk' ? 'driving' : 'walking'}`}
          >
            {travelMode === 'walk' ? '🚶 walk' : '🚗 drive'}
          </button>
          <span className="board__radiuslabel">within</span>
          {[5, 10, 15, 30].map((m) => (
            <button key={m} type="button" className={`fchip ${radiusMin === m ? 'fchip--on' : ''}`} aria-pressed={radiusMin === m} onClick={() => setRadiusMin(radiusMin === m ? null : m)}>
              {m} min
            </button>
          ))}
          <span className="board__radiuslabel">of <strong>{center!.label}</strong></span>
        </div>
      )}
      {(geoError || share.error) && <p className="join__error" role="alert">{geoError || share.error}</p>}

      {adding && <AddItemForm onDone={() => setAdding(false)} />}

      <aside className="board__map" aria-label="Map">
        <MapView items={filtered} selectedId={selectedId} userLocation={userLoc} presences={presences} focus={focus} onSelect={highlight} />
        <p className="board__maphint">
          {filtered.length} place{filtered.length === 1 ? '' : 's'} shown · tap a pin for details
          {presences.length > 0 && ` · ${presences.length} sharing location`}
        </p>
      </aside>

      <section className="board__list" aria-label="Trip items">
        {filtered.map((item) => {
          const distanceLabel =
            radiusMin && center && item.lat != null && item.lng != null
              ? `~${Math.max(1, Math.round(travelMinutes(center.lat, center.lng, item.lat, item.lng, travelMode)))} min ${travelMode === 'walk' ? '🚶' : '🚗'}`
              : null;
          return (
            <ItemCard
              key={item.itemId}
              item={item}
              family={family}
              distanceLabel={distanceLabel}
              expanded={expandedId === item.itemId}
              selected={selectedId === item.itemId}
              onToggle={() => setExpandedId((cur) => (cur === item.itemId ? null : item.itemId))}
            />
          );
        })}
        {filtered.length === 0 && <p className="board__empty">Nothing matches. Try a different search or suggest something.</p>}
      </section>

      {centerItem && (
        <div className="peek" role="dialog" aria-label={centerItem.title}>
          {centerItem.imageUrl && (
            <img className="peek__thumb" src={centerItem.imageUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          )}
          <div className="peek__body">
            <strong className="peek__title">{centerItem.title}</strong>
            <div className="peek__meta">
              {centerItem.isAnchor ? centerItem.anchorRole : centerItem.type === 'MEAL' ? centerItem.mealType : centerItem.category} · ★ {peekDetail.data?.item.voteScore ?? centerItem.voteScore}
            </div>
            {peekVotes.length > 0 ? (
              <div className="peek__voters" aria-label="Who voted">
                {peekVotes.slice(0, 6).map((v) => (
                  <Avatar key={v.voterId} name={v.voterName} size={18} />
                ))}
                <span className="peek__voternames">{peekVotes.map((v) => v.voterName).join(', ')}</span>
              </div>
            ) : (
              <div className="peek__novotes">No votes yet — tap Details to vote</div>
            )}
            {centerItem.address && <div className="peek__addr">📌 {centerItem.address}</div>}
            <div className="peek__actions">
              <a className="btn btn--link" href={mapsLink(centerItem)} target="_blank" rel="noreferrer noopener">🗺 Maps</a>
              {centerItem.website && (
                <a className="btn btn--link" href={centerItem.website} target="_blank" rel="noreferrer noopener">🔗 Site</a>
              )}
              <button type="button" className="btn btn--primary" onClick={() => select(centerItem.itemId)}>Details ›</button>
            </div>
          </div>
          <button type="button" className="peek__close" aria-label="Close" onClick={() => setSelectedId(null)}>✕</button>
        </div>
      )}

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

            <label className="sheet__label" htmlFor="f-price">Max price (per person)</label>
            <select id="f-price" value={maxPrice ?? ''} onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Any price</option>
              <option value="0">Free only</option>
              <option value="1000">Up to $10</option>
              <option value="2500">Up to $25</option>
              <option value="5000">Up to $50</option>
              <option value="10000">Up to $100</option>
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
