import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateItemInput, UpdateItemInput } from '@tripboard/shared';
import { useApp } from '../lib/context.js';

const BUNDLE_KEY = ['bundle'];

// Only fetch real photos for attraction-type places. Restaurants/shops/lodging
// rarely have a correct Wikipedia page and collide with unrelated articles
// (e.g. "The Bicycle Thief" → the film), so those use the emoji tile instead.
const PHOTO_CATEGORIES = new Set(['museum', 'landmark', 'viewpoint', 'beach', 'outdoor', 'playground', 'activity']);
const PHOTO_STOPWORDS = new Set([
  'the', 'and', 'of', 'at', 'on', 'in', 'a', 'to', 'park', 'centre', 'center',
  'museum', 'beach', 'tour', 'tours', 'nova', 'scotia', 'halifax', 'dartmouth',
]);

/**
 * Best-effort *related* real photo from Wikipedia (browser-side, no key, CORS via
 * origin=*). Scopes the search to Nova Scotia and only returns a thumbnail when the
 * matched article's title shares a meaningful word with the place — so we never show
 * an unrelated stock-y image. Returns null (→ emoji tile) otherwise.
 */
export function usePlacePhoto(item: { itemId: string; title: string; category?: string; type: string } | null, enabled: boolean) {
  const allow =
    enabled &&
    !!item &&
    item.type !== 'MEAL' &&
    !!item.category &&
    PHOTO_CATEGORIES.has(item.category);
  return useQuery({
    queryKey: ['placephoto', item?.itemId],
    enabled: allow,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const q = `${item!.title} Nova Scotia`;
      const url =
        'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
        '&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=900&gsrsearch=' +
        encodeURIComponent(q);
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string } }> };
      };
      const page = Object.values(data.query?.pages ?? {})[0];
      const src = page?.thumbnail?.source;
      if (!src) return null;
      const pageTitle = (page?.title ?? '').toLowerCase();
      const want = item!.title
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !PHOTO_STOPWORDS.has(w));
      const related = want.some((w) => pageTitle.includes(w));
      return related ? src : null;
    },
  });
}

export function useBundle() {
  const { api } = useApp();
  return useQuery({ queryKey: BUNDLE_KEY, queryFn: () => api.getBundle() });
}

export function useItemDetail(itemId: string | null) {
  const { api } = useApp();
  return useQuery({
    queryKey: ['item', itemId],
    queryFn: () => api.getDetail(itemId!),
    enabled: !!itemId,
  });
}

export function useCreateItem() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput) => api.createItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: BUNDLE_KEY }),
  });
}

export function useUpdateItem() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: UpdateItemInput }) =>
      api.updateItem(itemId, input),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: BUNDLE_KEY });
      qc.invalidateQueries({ queryKey: ['item', vars.itemId] });
    },
  });
}

export function useDeleteItem() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.deleteItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: BUNDLE_KEY }),
  });
}

export function useVote() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, voterId, value }: { itemId: string; voterId: string; value: number }) =>
      api.castVote(itemId, voterId, value),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: BUNDLE_KEY });
      qc.invalidateQueries({ queryKey: ['item', vars.itemId] });
    },
  });
}

export function useRemoveVote() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, voterId }: { itemId: string; voterId: string }) =>
      api.removeVote(itemId, voterId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: BUNDLE_KEY });
      qc.invalidateQueries({ queryKey: ['item', vars.itemId] });
    },
  });
}

export function usePresence(enabled = true) {
  const { api } = useApp();
  return useQuery({
    queryKey: ['presence'],
    queryFn: () => api.getPresence(),
    refetchInterval: 20_000,
    enabled,
  });
}

export function useAddComment() {
  const { api } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      api.addComment(itemId, text),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: BUNDLE_KEY });
      qc.invalidateQueries({ queryKey: ['item', vars.itemId] });
    },
  });
}
