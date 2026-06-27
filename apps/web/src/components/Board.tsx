import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { familyVoters, type Item, type ItemType, type TripBundle } from '@tripboard/shared';
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
    // Anchors pinned to the top, then highest score first.
    return items.slice().sort((a, b) => {
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1;
      return b.voteScore - a.voteScore;
    });
  }, [query, fuse, bundle.items, typeFilter, statusFilter]);

  function select(itemId: string) {
    setSelectedId(itemId);
    setExpandedId(itemId);
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

      {adding && <AddItemForm onDone={() => setAdding(false)} />}

      <div className="board__split">
        <section className="board__list" aria-label="Trip items">
          {filtered.map((item) => (
            <ItemCard
              key={item.itemId}
              item={item}
              family={family}
              expanded={expandedId === item.itemId}
              selected={selectedId === item.itemId}
              onToggle={() => setExpandedId((cur) => (cur === item.itemId ? null : item.itemId))}
            />
          ))}
          {filtered.length === 0 && <p className="board__empty">Nothing matches. Try a different search or suggest something.</p>}
        </section>

        <aside className="board__map" aria-label="Map">
          <MapView items={filtered} selectedId={selectedId} onSelect={select} />
        </aside>
      </div>
      </>
    );
  }
}
