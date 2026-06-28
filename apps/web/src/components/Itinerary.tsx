import { useEffect, useMemo, useState } from 'react';
import { buildItinerary, type Item } from '@tripboard/shared';
import { MapView } from './MapView.js';

/** Home base switches from the Dartmouth hotel to the Rose Bay Airbnb on this date. */
const AIRBNB_FROM = '2026-06-30';

function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Day-by-day itinerary of scheduled items with a per-day map that always includes the home base. */
export function Itinerary({ items, onSelect }: { items: Item[]; onSelect: (itemId: string) => void }) {
  const days = buildItinerary(items, '0000-00-00', '9999-99-99');
  const dayDates = days.map((d) => d.date);

  const hotel = items.find((i) => i.isAnchor && i.anchorRole === 'hotel') ?? null;
  const airbnb = items.find((i) => i.isAnchor && i.anchorRole === 'airbnb') ?? null;
  const lodgingFor = (date: string): Item | null => (date >= AIRBNB_FROM ? airbnb : hotel) ?? hotel ?? airbnb;

  const todayISO = new Date().toISOString().slice(0, 10);
  const [selDate, setSelDate] = useState<string | null>(null);
  const active = selDate && dayDates.includes(selDate)
    ? selDate
    : dayDates.includes(todayISO)
      ? todayISO
      : dayDates[0] ?? null;

  const dayItems = useMemo(() => {
    const d = days.find((x) => x.date === active);
    return d ? d.slots.flatMap((s) => s.items) : [];
  }, [days, active]);

  const lodging = lodgingFor(active ?? todayISO);

  const mapItems = useMemo(() => {
    const arr = dayItems.filter((i) => i.lat != null && i.lng != null);
    if (lodging && !arr.some((i) => i.itemId === lodging.itemId)) arr.push(lodging);
    return arr;
  }, [dayItems, lodging]);

  // Recenter the map on the day's home base whenever the selected day changes.
  const [focus, setFocus] = useState<{ lat: number; lng: number; nonce: number } | null>(null);
  useEffect(() => {
    const target = mapItems.find((i) => i.itemId === lodging?.itemId) ?? mapItems[0];
    if (target && target.lat != null && target.lng != null) {
      setFocus({ lat: target.lat, lng: target.lng, nonce: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="itin">
      <aside className="itin__map" aria-label="Itinerary map">
        <MapView items={mapItems} selectedId={null} onSelect={onSelect} focus={focus} />
        <p className="board__maphint">
          {active ? `${fmtDay(active)} · ${dayItems.length} stop${dayItems.length === 1 ? '' : 's'}` : 'Your plan'}
          {lodging ? ` · base: ${lodging.anchorRole === 'airbnb' ? '🏠 Airbnb' : '🏨 Hotel'}` : ''}
        </p>
      </aside>

      {dayDates.length > 0 && (
        <div className="itin__days" role="tablist" aria-label="Days">
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
              {d === todayISO ? ' • today' : ''}
            </button>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <p className="itin__empty">
          Nothing scheduled yet. Open an item and pick a date to build the day-by-day plan — it'll show here on the map.
        </p>
      ) : (
        days.map((day) => (
          <section key={day.date} className={`itin__day ${day.date === active ? 'itin__day--active' : ''}`}>
            <h3 className="itin__date">
              <button type="button" className="itin__datebtn" onClick={() => setSelDate(day.date)}>
                {fmtDay(day.date)}
                <span className="itin__base">{(lodgingFor(day.date)?.anchorRole === 'airbnb') ? ' 🏠' : ' 🏨'}</span>
              </button>
            </h3>
            {day.slots.map((slot) => (
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
            ))}
          </section>
        ))
      )}
    </div>
  );
}
