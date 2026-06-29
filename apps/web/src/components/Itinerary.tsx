import { useEffect, useMemo, useRef, useState } from 'react';
import { buildItinerary, type Item } from '@tripboard/shared';
import { MapView } from './MapView.js';
import { fmtDay, tripDays, todayISO } from '../lib/dates.js';

/** Cutover day: hotel through June 30, Airbnb from June 30 — and BOTH shown on June 30. */
const CUTOVER = '2026-06-30';

/**
 * Day-by-day itinerary: one swipeable day at a time, defaulting to today.
 * Every trip day is navigable (chips, ‹ › arrows, or swipe) — including days
 * with nothing scheduled yet — so you can plan ahead, not just review days that
 * already have items.
 */
export function Itinerary({
  items,
  tripStart,
  tripEnd,
  onSelect,
}: {
  items: Item[];
  tripStart?: string;
  tripEnd?: string;
  onSelect: (itemId: string) => void;
}) {
  const today = todayISO();
  const built = useMemo(() => buildItinerary(items, '0000-00-00', '9999-99-99'), [items]);
  const byDate = useMemo(() => new Map(built.map((d) => [d.date, d])), [built]);

  // Show the whole trip range + any day that has something scheduled + today,
  // so future/empty days are reachable and today is always present.
  const dayDates = useMemo(() => {
    const set = new Set<string>(tripDays(tripStart, tripEnd));
    for (const d of built) set.add(d.date);
    set.add(today);
    return [...set].sort();
  }, [tripStart, tripEnd, built, today]);

  const hotel = items.find((i) => i.isAnchor && i.anchorRole === 'hotel') ?? null;
  const airbnb = items.find((i) => i.isAnchor && i.anchorRole === 'airbnb') ?? null;
  /** Home base(s) for a date: hotel through June 30, Airbnb from June 30, both on June 30. */
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
  const dayItems = dayEntry ? dayEntry.slots.flatMap((s) => s.items) : [];
  const lodgings = lodgingsFor(active ?? today);

  const mapItems = useMemo(() => {
    const arr = dayItems.filter((i) => i.lat != null && i.lng != null);
    for (const l of lodgings) if (!arr.some((i) => i.itemId === l.itemId)) arr.push(l);
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayItems, active]);

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
        <MapView items={mapItems} selectedId={null} onSelect={onSelect} focus={focus} />
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

        {dayItems.length === 0 ? (
          <p className="itin__empty">
            Nothing planned for this day yet. Find a place on the board and tap 🗓 Plan to add it here, then swipe ‹ › between days.
          </p>
        ) : (
          dayEntry!.slots.map((slot) => (
            <div key={slot.slot} className="itin__slot">
              <span className="itin__slotName">{slot.slot}</span>
              <ul>
                {slot.items.map((it) => (
                  <li key={it.itemId}>
                    <button type="button" className="itin__item" onClick={() => onSelect(it.itemId)}>
                      <span aria-hidden="true">{it.type === 'MEAL' ? '🍽' : '📍'}</span> {it.title}
                      {it.status === 'done' && <span className="badge badge--status"> done</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
