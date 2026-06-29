import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { buildItinerary, haversineKm, travelMinutes, type Item, type Voter } from '@tripboard/shared';
import { MapView } from './MapView.js';
import { ItemCard } from './ItemCard.js';
import { useApp } from '../lib/context.js';
import { fmtDay, tripDays, todayISO } from '../lib/dates.js';

/** Cutover day: hotel through June 30, Airbnb from June 30 — and BOTH shown on June 30. */
const CUTOVER = '2026-06-30';
/** Chronological order of slots within a day (buildItinerary sorts alphabetically). */
const SLOT_ORDER = ['breakfast', 'morning', 'lunch', 'afternoon', 'snack', 'dinner', 'evening'];

/** Walking (short) or driving (longer) hop between two stops, or null if no coords. */
function legLabel(a: Item, b: Item): string | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
  if (km < 0.03) return null;
  const mode = km <= 2 ? 'walk' : 'drive';
  const min = Math.max(1, Math.round(travelMinutes(a.lat, a.lng, b.lat, b.lng, mode)));
  const dist = km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  return `${mode === 'walk' ? '🚶' : '🚗'} ${min} min · ${dist}`;
}

/**
 * Day-by-day itinerary: one swipeable day at a time (defaults to today). Tapping a
 * stop expands it in place (votes, comments, schedule) — no jump to the board — and
 * walking/driving distance is shown between consecutive stops.
 */
export function Itinerary({
  items,
  family,
  tripStart,
  tripEnd,
}: {
  items: Item[];
  family: Voter[];
  tripStart?: string;
  tripEnd?: string;
}) {
  const { hidden, hide, unhide } = useApp();
  const today = todayISO();
  const built = useMemo(() => buildItinerary(items, '0000-00-00', '9999-99-99'), [items]);
  const byDate = useMemo(() => new Map(built.map((d) => [d.date, d])), [built]);

  const dayDates = useMemo(() => {
    const set = new Set<string>(tripDays(tripStart, tripEnd));
    for (const d of built) set.add(d.date);
    set.add(today);
    return [...set].sort();
  }, [tripStart, tripEnd, built, today]);

  const hotel = items.find((i) => i.isAnchor && i.anchorRole === 'hotel') ?? null;
  const airbnb = items.find((i) => i.isAnchor && i.anchorRole === 'airbnb') ?? null;
  const lodgingsFor = (date: string): Item[] => {
    const out: Item[] = [];
    if (date <= CUTOVER && hotel) out.push(hotel);
    if (date >= CUTOVER && airbnb) out.push(airbnb);
    if (out.length === 0) out.push(...([hotel, airbnb].filter((x): x is Item => !!x)));
    return out;
  };
  const baseLabel = (ls: Item[]): string =>
    ls.map((l) => (l.anchorRole === 'airbnb' ? '🏠 Airbnb' : '🏨 Hotel')).join(' + ');

  const [selDate, setSelDate] = useState<string | null>(null);
  const active = selDate && dayDates.includes(selDate)
    ? selDate
    : dayDates.includes(today)
      ? today
      : dayDates[0] ?? null;
  const idx = active ? dayDates.indexOf(active) : -1;
  const go = (delta: number) => {
    const ni = idx + delta;
    if (ni >= 0 && ni < dayDates.length) setSelDate(dayDates[ni]!);
  };

  const dayEntry = active ? byDate.get(active) : undefined;
  // Flatten the day into a single chronological list of stops.
  const stops = useMemo(() => {
    if (!dayEntry) return [] as { item: Item; slot: string }[];
    return [...dayEntry.slots]
      .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
      .flatMap((s) => s.items.map((it) => ({ item: it, slot: s.slot })));
  }, [dayEntry]);
  const dayItems = stops.map((s) => s.item);
  const lodgings = lodgingsFor(active ?? today);

  const mapItems = useMemo(() => {
    const arr = dayItems.filter((i) => i.lat != null && i.lng != null);
    for (const l of lodgings) if (!arr.some((i) => i.itemId === l.itemId)) arr.push(l);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayItems, active]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  /** Map pin → expand that stop in context and scroll to it (no page change). */
  const handleSelect = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  // Recenter the map on the day's home base whenever the selected day changes.
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  useEffect(() => {
    const target = lodgings[0] ?? mapItems[0];
    if (target && target.lat != null && target.lng != null) {
      setFocus({ lat: target.lat, lng: target.lng, nonce: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Keep the active day chip scrolled into view.
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chipsRef.current?.querySelector('[aria-selected="true"]') as HTMLElement | null;
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);

  // Horizontal swipe on the day panel → previous/next day.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (dx < -45) go(1);
    else if (dx > 45) go(-1);
  };

  return (
    <div className="itin">
      <aside className="itin__map" aria-label="Itinerary map">
        <MapView items={mapItems} selectedId={expandedId} onSelect={handleSelect} focus={focus} />
        <p className="board__maphint">
          {active ? `${fmtDay(active)} · ${dayItems.length} stop${dayItems.length === 1 ? '' : 's'}` : 'Your plan'}
          {lodgings.length ? ` · base: ${baseLabel(lodgings)}` : ''}
        </p>
      </aside>

      <div className="itin__days" ref={chipsRef} role="tablist" aria-label="Days">
        {dayDates.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === active}
            className={`fchip ${d === active ? 'fchip--on' : ''}`}
            onClick={() => setSelDate(d)}
          >
            {fmtDay(d)}
            {d === today ? ' • today' : ''}
          </button>
        ))}
      </div>

      <section className="itin__day" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="itin__nav">
          <button type="button" className="itin__navbtn" aria-label="Previous day" disabled={idx <= 0} onClick={() => go(-1)}>‹</button>
          <h3 className="itin__date">
            {active ? fmtDay(active) : 'Your plan'}
            {active === today ? ' • today' : ''}
            <span className="itin__base"> {lodgings.map((l) => (l.anchorRole === 'airbnb' ? '🏠' : '🏨')).join('')}</span>
          </h3>
          <button type="button" className="itin__navbtn" aria-label="Next day" disabled={idx < 0 || idx >= dayDates.length - 1} onClick={() => go(1)}>›</button>
        </div>

        {stops.length === 0 ? (
          <p className="itin__empty">
            Nothing planned for this day yet. Find a place on the board and tap 🗓 Plan to add it here, then swipe ‹ › between days.
          </p>
        ) : (
          <div className="itin__stops">
            {stops.map((stop, i) => {
              const leg = i > 0 ? legLabel(stops[i - 1]!.item, stop.item) : null;
              const showSlot = i === 0 || stops[i - 1]!.slot !== stop.slot;
              return (
                <Fragment key={stop.item.itemId}>
                  {leg && <p className="itin__leg">{leg}</p>}
                  {showSlot && <p className="itin__slotHead">{stop.slot}</p>}
                  <ItemCard
                    item={stop.item}
                    family={family}
                    tripStart={tripStart}
                    tripEnd={tripEnd}
                    hidden={hidden.has(stop.item.itemId)}
                    onHide={() => hide(stop.item.itemId)}
                    onUnhide={() => unhide(stop.item.itemId)}
                    expanded={expandedId === stop.item.itemId}
                    selected={expandedId === stop.item.itemId}
                    onToggle={() => setExpandedId((c) => (c === stop.item.itemId ? null : stop.item.itemId))}
                  />
                </Fragment>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
