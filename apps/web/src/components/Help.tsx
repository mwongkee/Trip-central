import { useEffect } from 'react';

/** A short "how to use TripBoard" guide, shown as a dismissible overlay. */
export function Help({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="help" role="dialog" aria-modal="true" aria-label="How to use TripBoard" onClick={onClose}>
      <div className="help__card" onClick={(e) => e.stopPropagation()}>
        <div className="help__head">
          <h2>How to use TripBoard</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose} aria-label="Close help">
            ✕
          </button>
        </div>

        <ol className="help__list">
          <li>
            <strong>Join.</strong> Tap your name on the welcome screen (or add a new person). It’s remembered on this
            device — use <em>Switch user</em> in the top bar to change who you are.
          </li>
          <li>
            <strong>The map is home.</strong> Every pin is a place or meal, coloured by category. <strong>Tap a pin</strong>{' '}
            for a photo and details, then “Open details” to jump to its card. Pinch/drag to move around.
          </li>
          <li>
            <strong>Filter.</strong> Use the chips above the map: <strong>🌙 Tonight</strong> shows the walk-from-the-ferry
            plan, <strong>🚶 Walkable</strong> shows easy-on-foot spots, or tap a category (beach, museum…). It filters the
            map and the list together.
          </li>
          <li>
            <strong>Vote for your family.</strong> Open an item and, under “Vote for your family,” tap yourself and each of
            your kids — or <strong>Mark whole family</strong> to vote for everyone at once. Tap again to remove a vote. The
            score and who-voted update live for everyone.
          </li>
          <li>
            <strong>Open in Maps / Website.</strong> Each item has an <strong>🗺 Open in Maps</strong> link (for directions)
            and a <strong>🔗 Website</strong> link when available.
          </li>
          <li>
            <strong>Suggest something.</strong> Tap <strong>+ Suggest</strong> to add a place or meal, with an optional
            website and photo. New ideas start as “suggested” for everyone to vote on.
          </li>
          <li>
            <strong>Schedule &amp; itinerary.</strong> On an item, pick a date and time slot to schedule it. The{' '}
            <strong>📅 Itinerary</strong> tab shows the day-by-day plan. Mark items <em>done</em>, or <em>defer</em> a meal to
            the next time.
          </li>
          <li>
            <strong>Comments.</strong> Leave notes on any item — handy for “bring sunscreen” or “opens at 10.”
          </li>
        </ol>

        <p className="help__foot">Tip: everyone in the family can open the same link and join as themselves.</p>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
