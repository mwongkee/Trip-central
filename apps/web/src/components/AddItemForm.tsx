import { useForm } from 'react-hook-form';
import { CreateItemInput, type ItemType, type MealType, type Category } from '@tripboard/shared';
import { useCreateItem } from '../hooks/queries.js';

interface FormValues {
  type: ItemType;
  title: string;
  description: string;
  category: Category | '';
  mealType: MealType | '';
  address: string;
  lat: string;
  lng: string;
}

const CATEGORIES: Category[] = ['outdoor', 'museum', 'beach', 'playground', 'viewpoint', 'restaurant', 'lodging', 'other'];
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Suggest a new place or meal. Address geocoding (Amazon Location) is a TODO — see PLAN.md M1. */
export function AddItemForm({ onDone }: { onDone: () => void }) {
  const create = useCreateItem();
  const { register, handleSubmit, watch, reset, formState } = useForm<FormValues>({
    defaultValues: { type: 'PLACE', title: '', description: '', category: '', mealType: '', address: '', lat: '', lng: '' },
  });
  const type = watch('type');

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
      <input id="af-addr" {...register('address')} placeholder="Search coming soon — type for now" />

      <div className="addform__row">
        <div>
          <label htmlFor="af-lat">Lat</label>
          <input id="af-lat" {...register('lat')} inputMode="decimal" placeholder="44.65" />
        </div>
        <div>
          <label htmlFor="af-lng">Lng</label>
          <input id="af-lng" {...register('lng')} inputMode="decimal" placeholder="-63.57" />
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
