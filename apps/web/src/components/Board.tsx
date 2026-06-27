import { useMemo, useState } from 'react';
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
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  // The selected pin doubles as the center for "within X km" search.
  const centerItem = useMemo(
    () => bundle.items.find((i) => i.itemId === selectedId) ?? null,
    [bundle.items, selectedId],
  );
  const canRadius = !!(centerItem && typeof centerItem.lat === 'number' && typeof centerItem.lng === 'number');

  // Categories present in the trip, for the map/list filter chips.
  const categoryList = useMemo(() => {
    const s = new Set<string>();
    for (const i of bundle.items) if (i.category) s.add(i.category);
    return [...s].sort();
  }, [bundle.items]);

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
    if (radiusKm && centerItem && centerItem.lat != null && centerItem.lng != null) {
      items = items.filter(
        (i) => i.lat != null && i.lng != null && haversineKm(centerItem.lat!, centerItem.lng!, i.lat, i.lng) <= radiusKm,
      );
    }
    // Anchors pinned to the top, then highest score first.
    return items.slice().sort((a, b) => {
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1;
      return b.voteScore - a.voteScore;
    });
  }, [query, fuse, bundle.items, typeFilter, statusFilter, cats, tagFilter, radiusKm, centerItem]);

  function select(itemId: string) {
    setSelectedId(itemId);
    setExpandedId(itemId);
    // Bring the matching list card into view below the map.
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
      <div className="board__controls">
        <input
          type="search"
          className="board__search"
          placeholder="Search places, meals, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search trip items"
        />
        <label className="sr-only" htmlFor="f-type">Type</label>
        <select id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
          <option value="all">All types</option>
          <option value="PLACE">Places</option>
          <option value="MEAL">Meals</option>
        </select>
        <label className="sr-only" htmlFor="f-status">Status</label>
        <select id="f-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="all">Any status</option>
          <option value="suggested">Suggested</option>
          <option value="scheduled">Scheduled</option>
          <option value="done">Done</option>
        </select>
        <button type="button" className="btn btn--primary" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Close' : '+ Suggest'}
        </button>
      </div>

      <div className="board__filters" role="group" aria-label="Filters">
        <button type="button" className={`fchip ${tagFilter.has('tonight') ? 'fchip--on' : ''}`} aria-pressed={tagFilter.has('tonight')} onClick={() => toggle(tagFilter, setTagFilter, 'tonight')}>🌙 Tonight</button>
        <button type="button" className={`fchip ${tagFilter.has('walkable') ? 'fchip--on' : ''}`} aria-pressed={tagFilter.has('walkable')} onClick={() => toggle(tagFilter, setTagFilter, 'walkable')}>🚶 Walkable</button>
        <span className="board__filtersep" aria-hidden="true" />
        {categoryList.map((c) => (
          <button key={c} type="button" className={`fchip ${cats.has(c) ? 'fchip--on' : ''}`} aria-pressed={cats.has(c)} onClick={() => toggle(cats, setCats, c)}>
            {c}
          </button>
        ))}
        {(cats.size > 0 || tagFilter.size > 0) && (
          <button type="button" className="fchip fchip--clear" onClick={() => { setCats(new Set()); setTagFilter(new Set()); }}>
            clear ✕
          </button>
        )}
      </div>

      {canRadius ? (
        <div className="board__radius" role="group" aria-label="Distance from pin">
          <span className="board__radiuslabel">Within</span>
          {[1, 2, 5, 10].map((km) => (
            <button
              key={km}
              type="button"
              className={`fchip ${radiusKm === km ? 'fchip--on' : ''}`}
              aria-pressed={radiusKm === km}
              onClick={() => setRadiusKm(radiusKm === km ? null : km)}
            >
              {km} km
            </button>
          ))}
          <span className="board__radiuslabel">of <strong>{centerItem!.title}</strong></span>
          {radiusKm && (
            <button type="button" className="fchip fchip--clear" onClick={() => setRadiusKm(null)}>
              clear ✕
            </button>
          )}
        </div>
      ) : (
        <p className="board__radiushint">Tap a pin to find places near it.</p>
      )}

      {adding && <AddItemForm onDone={() => setAdding(false)} />}

      <aside className="board__map" aria-label="Map">
        <MapView items={filtered} selectedId={selectedId} onSelect={select} />
        <p className="board__maphint">{filtered.length} place{filtered.length === 1 ? '' : 's'} shown · tap a pin for details</p>
      </aside>

      <section className="board__list" aria-label="Trip items">
        {filtered.map((item) => {
          const distanceKm =
            radiusKm && centerItem && centerItem.lat != null && centerItem.lng != null && item.lat != null && item.lng != null
              ? haversineKm(centerItem.lat, centerItem.lng, item.lat, item.lng)
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
      </>
    );
  }
}
