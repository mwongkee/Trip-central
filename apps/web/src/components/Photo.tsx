import { useState } from 'react';
import type { Item } from '@tripboard/shared';
import { usePlacePhoto } from '../hooks/queries.js';
import { colorFor, iconFor } from './MapView.js';

/**
 * A place photo with NO stock filler. Shows a real image from Wikipedia when one
 * exists (only fetched when `fetch` is true), otherwise a clean category-coloured
 * tile with the place's emoji — never an unrelated stock photo.
 */
export function Photo({
  item,
  fetch = false,
  className = '',
}: {
  item: Item;
  fetch?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // A real, user-provided photo wins; ignore the old seed stock placeholders.
  const real = item.imageUrl && !item.imageUrl.includes('picsum.photos') ? item.imageUrl : null;
  const photo = usePlacePhoto(item, fetch && !real);
  const src = !failed ? real ?? photo.data : null;

  if (src) {
    return (
      <img
        className={className}
        src={src}
        alt={item.title}
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`${className} ph`}
      style={{ ['--ph-color' as string]: colorFor(item) } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="ph__emoji">{iconFor(item)}</span>
    </div>
  );
}
