import { useMemo, useRef, useState } from 'react';
import { familyVoters, travelMinutes, type Item, type TripBundle } from '@tripboard/shared';
import { useApp } from '../lib/context.js';
import { useVote, useItemDetail } from '../hooks/queries.js';
import { travelLabel } from '../lib/distance.js';
import { mapsLink } from '../lib/links.js';
import { Avatar } from './Avatar.js';
import { Photo } from './Photo.js';

const COMMIT = 110; // px past which a swipe commits

type Deck = {
  id: string;
  label: string;
  centerId: string; // reference point distances are shown from
  blurb: string;
  filter: (i: Item, center: { lat: number; lng: number } | null) => boolean;
};

const has = (i: Item, ...t: string[]): boolean => t.some((x) => i.tags.includes(x));
const coords = (i: Item): boolean => i.lat != null && i.lng != null;

// Curated, targeted swipe decks.
const DECKS: Deck[] = [
  {
    id: 'ferrywalk',
    label: '🚶 Walk from ferry',
    centerId: 'item-hfxterminal',
    blurb: 'Things to do within a ~20-min walk of the Halifax ferry',
    filter: (i, c) => !!c && coords(i) && travelMinutes(c.lat, c.lng, i.lat!, i.lng!, 'walk') <= 20,
  },
  {
    id: 'indoor',
    label: '🏛️ Indoor',
    centerId: 'item-hotel',
    blurb: 'Museums, shops and rainy-day spots',
    filter: (i) => ['museum', 'shopping'].includes(i.category ?? '') || has(i, 'rainy-day'),
  },
  {
    id: 'airbnb45',
    label: '🚗 ≤45 min from Airbnb',
    centerId: 'item-airbnb',
    blurb: 'Anything within a 45-min drive of the Rose Bay Airbnb',
    filter: (i, c) => !!c && coords(i) && travelMinutes(c.lat, c.lng, i.lat!, i.lng!, 'drive') <= 45,
  },
  {
    id: 'kids',
    label: '🧒 Kids',
    centerId: 'item-hotel',
    blurb: 'Kid-friendly places, playgrounds and beaches',
    filter: (i) => has(i, 'kids', 'stroller-friendly') || ['playground', 'beach'].includes(i.category ?? ''),
  },
  {
    id: 'food',
    label: '🍴 Food',
    centerId: 'item-hotel',
    blurb: 'Restaurants, treats and meals',
    filter: (i) => i.type === 'MEAL' || i.category === 'restaurant',
  },
  {
    id: 'all',
    label: '✨ Everything',
    centerId: 'item-hotel',
    blurb: 'Every place on the trip',
    filter: () => true,
  },
];

/**
 * "Swipe to vote" deck. Pick a targeted deck, then swipe through cards: right
 * (or ✓) casts your whole family's vote, left (or ✕) skips. Each card owns its
 * own gesture so swipes can't bleed between cards.
 */
export function SwipeDeck({ bundle }: { bundle: TripBundle }) {
  const { identity } = useApp();
  const vote = useVote();
  const [deckId, setDeckId] = useState('ferrywalk');
  const [idx, setIdx] = useState(0);
  const [lastVoted, setLastVoted] = useState<string | null>(null);

  const family = useMemo(
    () => (identity ? familyVoters(identity.familyId, bundle.members, bundle.children) : []),
    [identity, bundle.members, bundle.children],
  );

  const deck = DECKS.find((d) => d.id === deckId)!;
  const center = useMemo(() => {
    const c = bundle.items.find((i) => i.itemId === deck.centerId);
    return c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null;
  }, [bundle.items, deck.centerId]);

  const items = useMemo(
    () =>
      bundle.items
        .filter((i) => !i.isAnchor && deck.filter(i, center))
        .slice()
        .sort((a, b) => a.voteCount - b.voteCount || b.voteScore - a.voteScore || a.title.localeCompare(b.title)),
    [bundle.items, deck, center],
  );

  function selectDeck(id: string) {
    setDeckId(id);
    setIdx(0);
    setLastVoted(null);
  }

  const current = items[idx] ?? null;
  const next = items[idx + 1] ?? null;

  function handleVote(item: Item) {
    family.forEach((f) => vote.mutate({ itemId: item.itemId, voterId: f.voterId, value: 1 }));
    setLastVoted(item.title);
    setIdx((i) => i + 1);
  }
  function handleSkip() {
    setIdx((i) => i + 1);
  }

  return (
    <div className="swipe">
      <div className="swipe__decks" role="group" aria-label="Swipe deck">
        {DECKS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`fchip ${deckId === d.id ? 'fchip--on' : ''}`}
            aria-pressed={deckId === d.id}
            onClick={() => selectDeck(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="swipe__blurb">
        {deck.blurb}
        {items.length > 0 && <span className="swipe__count"> · {Math.min(idx + 1, items.length)} / {items.length}</span>}
      </p>

      {!current ? (
        <div className="swipe__done">
          {items.length === 0 ? (
            <>
              <p>Nothing in this deck.</p>
              <p className="swipe__donesub">Try another deck above.</p>
            </>
          ) : (
            <>
              <p>🎉 That's the whole deck!</p>
              <p className="swipe__donesub">You swiped through all {items.length}.</p>
              <button type="button" className="btn btn--primary" onClick={() => { setIdx(0); setLastVoted(null); }}>
                Start over
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="swipe__stack">
            {next && <SwipeCard key={`behind-${next.itemId}`} item={next} center={center} behind />}
            <SwipeCard
              key={`top-${current.itemId}`}
              item={current}
              center={center}
              onVote={handleVote}
              onSkip={handleSkip}
            />
          </div>
          <div className="swipe__actions">
            <button type="button" className="swipe__btn swipe__btn--skip" onClick={handleSkip} aria-label="Skip">
              ✕ Skip
            </button>
            <button
              type="button"
              className="swipe__btn swipe__btn--vote"
              onClick={() => handleVote(current)}
              disabled={family.length === 0}
              aria-label={`Vote for ${current.title} as your family`}
            >
              ✓ Vote ({family.length})
            </button>
          </div>
          {lastVoted && <p className="swipe__just" aria-live="polite">👍 Voted for {lastVoted}</p>}
        </>
      )}
    </div>
  );
}

function SwipeCard({
  item,
  center,
  behind = false,
  onVote,
  onSkip,
}: {
  item: Item;
  center: { lat: number; lng: number } | null;
  behind?: boolean;
  onVote?: (i: Item) => void;
  onSkip?: (i: Item) => void;
}) {
  const detail = useItemDetail(behind ? null : item.itemId);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fly, setFly] = useState(0); // -1 / +1 once a decision is committing
  const startX = useRef(0);
  const decided = useRef(false);

  const votes = detail.data?.votes ?? [];
  const dist = travelLabel(center, item.lat ?? undefined, item.lng ?? undefined);
  const bucket = item.type === 'MEAL' ? item.mealType : item.category;

  function decide(kind: 'vote' | 'skip') {
    if (decided.current) return;
    decided.current = true;
    setFly(kind === 'vote' ? 1 : -1);
    setDragging(false);
    setTimeout(() => (kind === 'vote' ? onVote?.(item) : onSkip?.(item)), 200);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (behind || decided.current) return;
    if ((e.target as HTMLElement).closest('a, button')) return; // let links/buttons work
    startX.current = e.clientX;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || decided.current) return;
    setDx(e.clientX - startX.current);
  }
  function onPointerUp() {
    if (!dragging || decided.current) return;
    setDragging(false);
    if (dx > COMMIT) decide('vote');
    else if (dx < -COMMIT) decide('skip');
    else setDx(0);
  }

  const offX = fly !== 0 ? fly * (typeof window !== 'undefined' ? window.innerWidth + 220 : 600) : dx;
  const hint = !behind && (dx > 40 || fly > 0) ? 'vote' : !behind && (dx < -40 || fly < 0) ? 'skip' : null;
  const style = behind
    ? { transform: 'scale(0.95) translateY(10px)' }
    : {
        transform: `translateX(${offX}px) rotate(${offX * 0.03}deg)`,
        transition: dragging ? 'none' : 'transform 0.22s ease',
      };

  return (
    <article
      className={`swipe__card ${behind ? 'swipe__card--behind' : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { setDragging(false); if (!decided.current) setDx(0); }}
    >
      {hint && <span className={`swipe__stamp swipe__stamp--${hint}`}>{hint === 'vote' ? '👍 VOTE' : 'SKIP'}</span>}
      <div className="swipe__photo">
        <Photo item={item} fetch={!behind} className="swipe__img" />
        {dist && <span className="swipe__dist">{dist}</span>}
      </div>
      <div className="swipe__info">
        <h3 className="swipe__title">{item.title}</h3>
        <div className="swipe__meta">
          <span className={`badge badge--${item.type.toLowerCase()}`}>{item.type === 'MEAL' ? '🍽' : '📍'} {bucket}</span>
          <span className="card__score">★ {item.voteScore}</span>
          {item.estCost != null && <span className="badge">{item.estCost === 0 ? 'Free' : `$${Math.round(item.estCost / 100)}`}</span>}
        </div>
        {item.description && <p className="swipe__desc">{item.description}</p>}
        {item.address && <p className="swipe__addr">📌 {item.address}</p>}
        {votes.length > 0 && (
          <div className="swipe__voters" aria-label="Who voted">
            {votes.slice(0, 8).map((v) => <Avatar key={v.voterId} name={v.voterName} size={20} />)}
            <span className="swipe__voternames">{votes.map((v) => v.voterName).join(', ')}</span>
          </div>
        )}
        <div className="swipe__links">
          <a className="btn btn--link" href={mapsLink(item)} target="_blank" rel="noreferrer noopener">🗺 Maps</a>
          {item.website && <a className="btn btn--link" href={item.website} target="_blank" rel="noreferrer noopener">🔗 Website</a>}
        </div>
      </div>
    </article>
  );
}
