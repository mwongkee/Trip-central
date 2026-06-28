import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateItemInput, UpdateItemInput } from '@tripboard/shared';
import { useApp } from '../lib/context.js';

const BUNDLE_KEY = ['bundle'];

/**
 * Best-effort real photo from Wikipedia's public API (runs in the browser, no key,
 * CORS via origin=*). Returns a thumbnail URL when the place has a Wikipedia page,
 * else null so callers fall back to the placeholder. Cached forever per query.
 */
export function useWikiImage(title: string | null) {
  return useQuery({
    queryKey: ['wikiimg', title],
    enabled: !!title,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const url =
        'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
        '&prop=pageimages&piprop=thumbnail&pithumbsize=900&redirects=1&titles=' +
        encodeURIComponent(title!);
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
      };
      const pages = data.query?.pages ?? {};
      for (const key of Object.keys(pages)) {
        const src = pages[key]?.thumbnail?.source;
        if (src) return src;
      }
      return null;
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
