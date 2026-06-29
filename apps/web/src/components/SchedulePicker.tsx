import { useEffect, useMemo, useState } from 'react';
import type { Item, Slot } from '@tripboard/shared';
import { useUpdateItem } from '../hooks/queries.js';
import { fmtDay, shortSlot, tripDays, todayISO } from '../lib/dates.js';

const PLACE_SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];
const MEAL_SLOTS: Slot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Prior schedule snapshot, so an action can be undone. */
export interface SchedulePrior {
  status: Item['status'];
  scheduledDate?: string;
  slot?: Slot;
}

/**
 * Bottom-sheet to plan a place/meal onto a trip day in two taps — day chips
 * (real trip dates) + a slot chip, then Save. Reuses the .sheet + fchip styles.
 * onResult lets the caller (Board) show an undo toast; it's optional so the
 * expanded card can reuse the same picker without one.
 */
export function SchedulePicker({
  item,
  tripStart,
  tripEnd,
  onClose,
  onResult,
}: {
  item: Item;
  tripStart?: string;
  tripEnd?: string;
  onClose: () => void;
  onResult?: (msg: string, prior: SchedulePrior, itemId: string) => void;
}) {
  const update = useUpdateItem();
  const isMeal = item.type === 'MEAL';
  const slots = isMeal ? MEAL_SLOTS : PLACE_SLOTS;
  const scheduled = item.status === 'scheduled';

  const today = todayISO();
  const defaultSlot = (item.slot ?? item.mealType ?? (isMeal ? 'lunch' : 'morning')) as Slot;
  const [day, setDay] = useState<string>(item.scheduledDate ?? today);
  const [slot, setSlot] = useState<Slot>(slots.includes(defaultSlot) ? defaultSlot : slots[0]!);

  // Trip days, always plus today and the current selection (so today and any
  // hand-picked date are selectable, not just the trip range).
  const days = useMemo(() => {
    const set = new Set<string>(tripDays(tripStart, tripEnd));
    set.add(today);
    if (item.scheduledDate) set.add(item.scheduledDate);
    if (day) set.add(day);
    return [...set].sort();
  }, [tripStart, tripEnd, today, item.scheduledDate, day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const prior: SchedulePrior = { status: item.status, scheduledDate: item.scheduledDate, slot: item.slot };
  const chosenDay = day;

  function save() {
    if (!chosenDay) return;
    update.mutate(
      { itemId: item.itemId, input: { status: 'scheduled', scheduledDate: chosenDay, slot } },
      { onSuccess: () => { onResult?.(`Planned for ${fmtDay(chosenDay)} · ${shortSlot(slot)}`, prior, item.itemId); onClose(); } },
    );
  }
  function remove() {
    update.mutate(
      { itemId: item.itemId, input: { status: 'suggested' } },
      { onSuccess: () => { onResult?.('Removed from plan', prior, item.itemId); onClose(); } },
    );
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`Plan ${item.title}`} onClick={onClose}>
      <div className="sheet__card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>Plan “{item.title}”</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p className="sheet__label">Which day?</p>
        <div className="sheet__chips sched__days">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={`fchip ${day === d ? 'fchip--on' : ''}`}
              aria-pressed={day === d}
              onClick={() => setDay(d)}
            >
              {fmtDay(d)}{d === today ? ' • today' : ''}
            </button>
          ))}
        </div>
        <label className="sched__pick">
          <span>Or pick any date</span>
          <input type="date" value={day} onChange={(e) => { if (e.target.value) setDay(e.target.value); }} aria-label="Pick a date" />
        </label>

        <p className="sheet__label">When that day?</p>
        <div className="sheet__chips">
          {slots.map((s) => (
            <button
              key={s}
              type="button"
              className={`fchip sched__slot ${slot === s ? 'fchip--on' : ''}`}
              aria-pressed={slot === s}
              onClick={() => setSlot(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="sheet__foot">
          {scheduled && (
            <button type="button" className="btn btn--ghost" onClick={remove} disabled={update.isPending}>
              Remove from plan
            </button>
          )}
          <button type="button" className="btn btn--primary" onClick={save} disabled={!chosenDay || update.isPending}>
            {update.isPending ? 'Saving…' : scheduled ? 'Update plan' : 'Save plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
