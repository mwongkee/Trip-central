import { buildItinerary, type Item } from '@tripboard/shared';

/** Day-by-day itinerary of scheduled items, grouped by date then slot (M3). */
export function Itinerary({ items, onSelect }: { items: Item[]; onSelect: (itemId: string) => void }) {
  const days = buildItinerary(items, '0000-00-00', '9999-99-99');

  if (days.length === 0) {
    return (
      <p className="itin__empty">
        Nothing scheduled yet. Open an item and pick a date to build the day-by-day plan.
      </p>
    );
  }

  return (
    <div className="itin">
      {days.map((day) => (
        <section key={day.date} className="itin__day">
          <h3 className="itin__date">
            {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
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
      ))}
    </div>
  );
}
