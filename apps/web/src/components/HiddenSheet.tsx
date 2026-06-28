import { useEffect } from 'react';
import type { Item } from '@tripboard/shared';
import { useApp } from '../lib/context.js';
import { Photo } from './Photo.js';

/** Review & restore per-device hidden ("noped") places. */
export function HiddenSheet({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const { hidden, unhide, unhideAll } = useApp();
  const list = items.filter((i) => hidden.has(i.itemId));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Hidden places" onClick={onClose}>
      <div className="sheet__card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>Hidden places</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {list.length === 0 ? (
          <p className="board__empty">Nothing hidden. Tap 🙅 Hide on a place to declutter your map.</p>
        ) : (
          <ul className="hidden__list">
            {list.map((item) => (
              <li key={item.itemId} className="hidden__row">
                <Photo item={item} className="card__thumb" />
                <div className="hidden__text">
                  <span className="hidden__title">{item.title}</span>
                  <span className="hidden__meta">{item.type === 'MEAL' ? item.mealType : item.category}</span>
                </div>
                <button type="button" className="btn" aria-label={`Unhide ${item.title}`} onClick={() => unhide(item.itemId)}>🙈 Unhide</button>
              </li>
            ))}
          </ul>
        )}

        <div className="sheet__foot">
          {list.length > 0 && <button type="button" className="btn" onClick={unhideAll}>Unhide all ({list.length})</button>}
          <button type="button" className="btn btn--primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
