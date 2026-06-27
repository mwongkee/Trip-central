import { useState } from 'react';
import type { Item, Slot, Voter } from '@tripboard/shared';
import { VoteControl } from './VoteControl.js';
import { Comments } from './Comments.js';
import {
  useItemDetail,
  useVote,
  useRemoveVote,
  useAddComment,
  useUpdateItem,
  useDeleteItem,
} from '../hooks/queries.js';

interface ItemCardProps {
  item: Item;
  family: Voter[];
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
}

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening', 'breakfast', 'lunch', 'dinner', 'snack'];

export function ItemCard({ item, family, expanded, selected, onToggle }: ItemCardProps) {
  const detail = useItemDetail(expanded ? item.itemId : null);
  const vote = useVote();
  const removeVote = useRemoveVote();
  const addComment = useAddComment();
  const update = useUpdateItem();
  const del = useDeleteItem();

  const [schedDate, setSchedDate] = useState(item.scheduledDate ?? '');
  const [schedSlot, setSchedSlot] = useState<Slot>(item.slot ?? (item.mealType ?? 'morning'));

  const votes = detail.data?.votes ?? [];
  const comments = detail.data?.comments ?? [];
  const liveItem = detail.data?.item ?? item;
  const busy = vote.isPending || removeVote.isPending;

  const bucket = item.type === 'MEAL' ? item.mealType : item.category;

  return (
    <article className={`card ${selected ? 'card--sel' : ''} status-${item.status}`}>
      <button type="button" className="card__head" aria-expanded={expanded} onClick={onToggle}>
        <span className="card__title">
          {item.isAnchor && <span className="badge badge--anchor" title={`Anchor: ${item.anchorRole}`}>★ {item.anchorRole}</span>}
          {item.title}
        </span>
        <span className="card__meta">
          <span className={`badge badge--${item.type.toLowerCase()}`}>{item.type === 'MEAL' ? '🍽' : '📍'} {bucket}</span>
          <span className={`badge badge--status`}>{item.status}</span>
          <span className="card__score" aria-label={`Score ${liveItem.voteScore}`}>★ {liveItem.voteScore}</span>
        </span>
      </button>

      {item.description && <p className="card__desc">{item.description}</p>}
      {item.address && <p className="card__addr">📌 {item.address}</p>}

      {expanded && (
        <div className="card__body">
          {detail.isLoading ? (
            <p>Loading…</p>
          ) : (
            <>
              <VoteControl
                item={liveItem}
                votes={votes}
                family={family}
                busy={busy}
                onVote={(voterId, value) => vote.mutate({ itemId: item.itemId, voterId, value })}
                onRemove={(voterId) => removeVote.mutate({ itemId: item.itemId, voterId })}
              />

              <div className="card__schedule">
                <h4>Schedule</h4>
                <div className="card__schedRow">
                  <label className="sr-only" htmlFor={`date-${item.itemId}`}>Date</label>
                  <input id={`date-${item.itemId}`} type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
                  <label className="sr-only" htmlFor={`slot-${item.itemId}`}>Slot</label>
                  <select id={`slot-${item.itemId}`} value={schedSlot} onChange={(e) => setSchedSlot(e.target.value as Slot)}>
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn"
                    disabled={!schedDate || update.isPending}
                    onClick={() => update.mutate({ itemId: item.itemId, input: { status: 'scheduled', scheduledDate: schedDate, slot: schedSlot } })}
                  >
                    Schedule
                  </button>
                </div>
                <div className="card__schedRow">
                  {item.status === 'scheduled' && (
                    <button type="button" className="btn" onClick={() => update.mutate({ itemId: item.itemId, input: { status: 'done' } })}>
                      ✓ Mark done
                    </button>
                  )}
                  {item.type === 'MEAL' && (
                    <button
                      type="button"
                      className="btn"
                      title="Go out to a later meal — keeps votes & comments"
                      onClick={() => update.mutate({ itemId: item.itemId, input: { action: 'defer', toMealType: item.mealType } })}
                    >
                      ↪ Defer to next {item.mealType}
                    </button>
                  )}
                  <button type="button" className="btn btn--danger" onClick={() => { if (confirm(`Delete "${item.title}"?`)) del.mutate(item.itemId); }}>
                    Delete
                  </button>
                </div>
              </div>

              <Comments
                comments={comments}
                busy={addComment.isPending}
                onAdd={(text) => addComment.mutate({ itemId: item.itemId, text })}
              />
            </>
          )}
        </div>
      )}
    </article>
  );
}
