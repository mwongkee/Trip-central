import { useMemo, useRef, useState } from 'react';
import { familyVoters, type Item, type TripBundle } from '@tripboard/shared';
import { useApp } from '../lib/context.js';
import { useVote, useItemDetail, useWikiImage } from '../hooks/queries.js';
import { travelLabel } from '../lib/distance.js';
import { mapsLink } from '../lib/links.js';
import { Avatar } from './Avatar.js';

const CENTERS: { id: string; emoji: string; short: string }[] = [
  { id: 'item-hfxterminal', emoji: '⛴', short: 'Ferry' },
  { id: 'item-hotel', emoji: '🏨', short: 'Hotel' },
  { id: 'item-airbnb', emoji: '🏠', short: 'Airbnb' },
];

const COMMIT = 110; // px drag past which a swipe commits

/**
 * "Swipe to vote" deck — one place per card with a big photo, details, distance
 * from a central location, and links. Swipe right (or ✓) = your family votes;
 * swipe left (or ✕) = skip. Buttons mirror the gestures for accessibility.
 */
export function SwipeDeck({ bundle }: { bundle: TripBundle }) {
  const { identity } = useApp();
  const vote = useVote();
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [centerId, setCenterId] = useState('item-hotel');
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const startX = useRef(0);

  const family = useMemo(
    () => (identity ? familyVoters(identity.familyId, bundle.members, bundle.children) : []),
    [identity, bundle.members, bundle.children],
  );

  const center = useMemo(() => {
    const c = bundle.items.find((i) => i.itemId === centerId);
    return c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null;
  }, [bundle.items, centerId]);

  // Things to triage: real places & meals (no anchors), least-voted first so
  // under-loved spots surface for a decision.
  const deck = useMemo(
    () =>
      bundle.items
        .filter((i) => !i.isAnchor)
        .slice()
        .sort((a, b) => a.voteCount - b.voteCount || b.voteScore - a.voteScore || a.title.localeCompare(b.title)),
    [bundle.items],
  );

  const current = deck[idx] ?? null;
  const next = deck[idx + 1] ?? null;

  function advance() {
    setDrag(0);
    setDragging(false);
    setIdx((i) => i + 1);
  }

  function castFamily(item: Item) {
    family.forEach((f) => vote.mutate({ itemId: item.itemId, voterId: f.voterId, value: 1 }));
    setVoted((s) => new Set(s).add(item.itemId));
    advance();
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDrag(e.clientX - startX.current);
  }
  function onPointerUp() {
    if (!dragging || !current) return;
    if (drag > COMMIT) castFamily(current);
    else if (drag < -COMMIT) advance();
    else {
      setDrag(0);
      setDragging(false);
    }
  }

  if (!current) {
    return (
      <div className="swipe">
        <div className="swipe__done">
          <p>🎉 That's everything!</p>
          <p className="swipe__donesub">You've swiped through all {deck.length} places.</p>
          <button type="button" className="btn btn--primary" onClick={() => { setIdx(0); setVoted(new Set()); }}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  const hint = drag > 40 ? 'vote' : drag < -40 ? 'skip' : null;

  return (
    <div className="swipe">
      <div className="swipe__centers" role="group" aria-label="Distance from">
        <span className="board__centerslabel">📏 From</span>
        {CENTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`fchip ${centerId === c.id ? 'fchip--on' : ''}`}
            aria-pressed={centerId === c.id}
            onClick={() => setCenterId(c.id)}
          >
            {c.emoji} {c.short}
          </button>
        ))}
        <span className="swipe__count">{idx + 1} / {deck.length}</span>
      </div>

      <div className="swipe__stack">
        {next && <SwipeCard key={next.itemId} item={next} center={center} behind />}
        <SwipeCard
          key={current.itemId}
          item={current}
          center={center}
          drag={drag}
          dragging={dragging}
          hint={hint}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      </div>

      <div className="swipe__actions">
        <button type="button" className="swipe__btn swipe__btn--skip" onClick={advance} aria-label="Skip">
          ✕ Skip
        </button>
        <button
          type="button"
          className="swipe__btn swipe__btn--vote"
          onClick={() => castFamily(current)}
          disabled={family.length === 0}
          aria-label={`Vote for ${current.title} as your family`}
        >
          ✓ Vote ({family.length})
        </button>
      </div>
      {voted.has(deck[idx - 1]?.itemId ?? '') && idx > 0 && (
        <p className="swipe__just" aria-live="polite">👍 Voted for {deck[idx - 1]!.title}</p>
      )}
    </div>
  );
}

function SwipeCard({
  item,
  center,
  drag = 0,
  dragging = false,
  hint = null,
  behind = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  item: Item;
  center: { lat: number; lng: number } | null;
  drag?: number;
  dragging?: boolean;
  hint?: 'vote' | 'skip' | null;
  behind?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}) {
  const wiki = useWikiImage(behind ? null : item.title);
  const detail = useItemDetail(behind ? null : item.itemId);
  const votes = detail.data?.votes ?? [];
  const photo = wiki.data || item.imageUrl;
  const dist = travelLabel(center, item.lat ?? undefined, item.lng ?? undefined);
  const bucket = item.type === 'MEAL' ? item.mealType : item.category;

  const style = behind
    ? { transform: 'scale(0.95) translateY(10px)' }
    : {
        transform: `translateX(${drag}px) rotate(${drag * 0.04}deg)`,
        transition: dragging ? 'none' : 'transform 0.25s ease',
      };

  return (
    <article className={`swipe__card ${behind ? 'swipe__card--behind' : ''}`} style={style}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      {!behind && hint && (
        <span className={`swipe__stamp swipe__stamp--${hint}`}>{hint === 'vote' ? '👍 VOTE' : 'SKIP'}</span>
      )}
      <div className="swipe__photo">
        {photo && <img src={photo} alt={item.title} draggable={false}
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}
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
