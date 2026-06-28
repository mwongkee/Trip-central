import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CreateItemInput, type ItemType, type MealType, type Category } from '@tripboard/shared';
import { useCreateItem } from '../hooks/queries.js';
import { parseGoogleMapsCoords, searchPlaces, type GeoResult } from '../lib/geocode.js';

interface FormValues {
  type: ItemType;
  title: string;
  description: string;
  category: Category | '';
  mealType: MealType | '';
  address: string;
  lat: string;
  lng: string;
  website: string;
  imageUrl: string;
}

const CATEGORIES: Category[] = ['outdoor', 'museum', 'beach', 'playground', 'viewpoint', 'restaurant', 'lodging', 'landmark', 'activity', 'shopping', 'other'];
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Suggest a new place or meal — find it by name (OpenStreetMap) or paste a Maps link. */
export function AddItemForm({ onDone }: { onDone: () => void }) {
  const create = useCreateItem();
  const { register, handleSubmit, watch, reset, setValue, getValues, formState } = useForm<FormValues>({
    defaultValues: { type: 'PLACE', title: '', description: '', category: '', mealType: '', address: '', lat: '', lng: '', website: '', imageUrl: '' },
  });
  const type = watch('type');
  const lat = watch('lat');
  const lng = watch('lng');

  const [find, setFind] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [findMsg, setFindMsg] = useState<string | null>(null);

  async function runFind() {
    const q = find.trim();
    if (!q) return;
    setFindMsg(null);
    const coords = parseGoogleMapsCoords(q);
    if (coords) {
      setValue('lat', String(coords.lat));
      setValue('lng', String(coords.lng));
      setResults([]);
      setFindMsg('📍 Pinned from the link — give it a title and add it.');
      return;
    }
    setSearching(true);
    try {
      const r = await searchPlaces(q);
      setResults(r);
      setFindMsg(r.length === 0 ? 'No matches — try a different name, or paste a Maps link / coordinates.' : null);
    } catch {
      setFindMsg('Search failed — check your connection, or paste a Maps link / coordinates.');
    } finally {
      setSearching(false);
    }
  }

  function pick(r: GeoResult) {
    if (!getValues('title').trim()) setValue('title', r.name);
    setValue('address', r.address);
    setValue('lat', String(r.lat));
    setValue('lng', String(r.lng));
    if (r.category) setValue('category', r.category);
    setValue('type', 'PLACE');
    setResults([]);
    setFindMsg(`📍 Pinned ${r.name}.`);
  }

  const onSubmit = handleSubmit(async (v) => {
    const lat = v.lat ? Number(v.lat) : undefined;
    const lng = v.lng ? Number(v.lng) : undefined;
    const candidate = {
      type: v.type,
      title: v.title.trim(),
      description: v.description.trim() || undefined,
      category: v.type === 'PLACE' ? (v.category || 'other') : v.category || undefined,
      mealType: v.type === 'MEAL' ? (v.mealType || 'dinner') : undefined,
      address: v.address.trim() || undefined,
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      website: v.website.trim() || undefined,
      imageUrl: v.imageUrl.trim() || undefined,
    };
    const parsed = CreateItemInput.safeParse(candidate);
    if (!parsed.success) return;
    await create.mutateAsync(parsed.data);
    reset();
    onDone();
  });

  return (
    <form className="addform" onSubmit={onSubmit}>
      <h3>Suggest something</h3>

      <label htmlFor="af-find">🔎 Find a place or paste a Google Maps link</label>
      <div className="addform__findrow">
        <input
          id="af-find"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runFind(); } }}
          placeholder="e.g. Bar Kismet  ·  or a maps.google link"
        />
        <button type="button" className="btn" onClick={runFind} disabled={searching}>
          {searching ? '…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="addform__results" aria-label="Search results">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button type="button" className="addform__result" onClick={() => pick(r)}>
                <span className="addform__resultname">{r.name}</span>
                <span className="addform__resultaddr">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {findMsg && <p className="addform__hint" aria-live="polite">{findMsg}</p>}

      <div className="addform__row">
        <label>
          <input type="radio" value="PLACE" {...register('type')} /> Place
        </label>
        <label>
          <input type="radio" value="MEAL" {...register('type')} /> Meal
        </label>
      </div>

      <label htmlFor="af-title">Title</label>
      <input id="af-title" {...register('title', { required: true })} placeholder="What is it?" />

      <label htmlFor="af-desc">Description</label>
      <textarea id="af-desc" {...register('description')} rows={2} placeholder="Why it's worth it…" />

      {type === 'PLACE' ? (
        <>
          <label htmlFor="af-cat">Category</label>
          <select id="af-cat" {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label htmlFor="af-meal">Meal</label>
          <select id="af-meal" {...register('mealType')}>
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor="af-addr">Address (optional)</label>
      <input id="af-addr" {...register('address')} placeholder="e.g. 1675 Lower Water St, Halifax" />
      <p className="addform__hint">Title + address power the “Open in Maps” link automatically.</p>

      <label htmlFor="af-web">Website (optional)</label>
      <input id="af-web" {...register('website')} inputMode="url" placeholder="https://…" />

      <label htmlFor="af-img">Photo URL (optional)</label>
      <input id="af-img" {...register('imageUrl')} inputMode="url" placeholder="https://… real photo URL (blank = emoji tile)" />

      <label htmlFor="af-lat">
        Location {lat && lng ? <span className="addform__pinned">✓ pinned — shows on the map</span> : <span className="addform__hint">— use Find above, or enter manually</span>}
      </label>
      <div className="addform__row">
        <div>
          <input id="af-lat" {...register('lat')} inputMode="decimal" placeholder="Lat 44.65" aria-label="Latitude" />
        </div>
        <div>
          <input id="af-lng" {...register('lng')} inputMode="decimal" placeholder="Lng -63.57" aria-label="Longitude" />
        </div>
      </div>

      <div className="addform__actions">
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={formState.isSubmitting || create.isPending}>
          Add suggestion
        </button>
      </div>
      {create.isError && <p role="alert" className="join__error">Could not add: {(create.error as Error).message}</p>}
    </form>
  );
}
