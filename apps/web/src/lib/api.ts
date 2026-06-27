import type {
  TripBundle,
  ItemDetail,
  Item,
  Member,
  Comment,
  CreateItemInput,
  UpdateItemInput,
  JoinInput,
} from '@tripboard/shared';
import { DEMO_TRIP_ID } from '@tripboard/shared';
import { LocalStore } from './localStore.js';
import type { DeviceIdentity } from './identity.js';

/** Operations the UI needs; both LocalStore and HttpApi satisfy this. */
export interface Api {
  readonly mode: 'local' | 'http';
  getBundle(): Promise<TripBundle>;
  getDetail(itemId: string): Promise<ItemDetail>;
  createItem(input: CreateItemInput): Promise<Item>;
  updateItem(itemId: string, input: UpdateItemInput): Promise<Item>;
  deleteItem(itemId: string): Promise<void>;
  castVote(itemId: string, voterId: string, value: number): Promise<void>;
  removeVote(itemId: string, voterId: string): Promise<void>;
  addComment(itemId: string, text: string, parentCommentId?: string): Promise<Comment>;
  join(input: JoinInput): Promise<Member>;
  reset?(): void;
}

class HttpApi implements Api {
  readonly mode = 'http' as const;
  constructor(
    private readonly base: string,
    private readonly tripId: string,
    private readonly getIdentity: () => DeviceIdentity | null,
  ) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const id = this.getIdentity();
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (id) {
      headers['x-tripboard-user'] = id.userId;
      headers['x-tripboard-name'] = encodeURIComponent(id.name);
    }
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const data = (await res.json()) as unknown;
    if (!res.ok) {
      const err = data as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `request failed (${res.status})`);
    }
    return data as T;
  }

  private t(path: string): string {
    return `/trips/${this.tripId}${path}`;
  }

  getBundle(): Promise<TripBundle> {
    return this.req('GET', this.t(''));
  }
  getDetail(itemId: string): Promise<ItemDetail> {
    return this.req<ItemDetail>('GET', this.t(`/items/${itemId}`)).catch(async () => {
      // Fall back to bundle + comments if the detail route isn't present.
      const [bundle, comments] = await Promise.all([
        this.getBundle(),
        this.req<{ comments: Comment[] }>('GET', this.t(`/items/${itemId}/comments`)),
      ]);
      const item = bundle.items.find((i) => i.itemId === itemId);
      if (!item) throw new Error('item not found');
      return { item, votes: [], comments: comments.comments };
    });
  }
  createItem(input: CreateItemInput): Promise<Item> {
    return this.req('POST', this.t('/items'), input);
  }
  updateItem(itemId: string, input: UpdateItemInput): Promise<Item> {
    return this.req('PATCH', this.t(`/items/${itemId}`), input);
  }
  deleteItem(itemId: string): Promise<void> {
    return this.req('DELETE', this.t(`/items/${itemId}`));
  }
  async castVote(itemId: string, voterId: string, value: number): Promise<void> {
    await this.req('POST', this.t(`/items/${itemId}/votes`), { voterId, value });
  }
  async removeVote(itemId: string, voterId: string): Promise<void> {
    await this.req('DELETE', this.t(`/items/${itemId}/votes/${voterId}`));
  }
  async addComment(itemId: string, text: string, parentCommentId?: string): Promise<Comment> {
    const r = await this.req<{ comment: Comment }>('POST', this.t(`/items/${itemId}/comments`), {
      text,
      parentCommentId,
    });
    return r.comment;
  }
  join(input: JoinInput): Promise<Member> {
    return this.req('POST', this.t('/join'), input);
  }
}

/**
 * Choose the backend:
 * - `VITE_API_BASE` set to a URL or `/api` → real backend (prod / dev-against-deployed).
 * - `VITE_API_BASE=local` or unset in dev → the in-browser LocalStore (no AWS needed).
 * - production build with nothing set → same-origin `/api` (as the architecture intends).
 */
export function createApi(getIdentity: () => DeviceIdentity | null): Api {
  const base = import.meta.env.VITE_API_BASE as string | undefined;
  if (base && base !== 'local') {
    return new HttpApi(base, DEMO_TRIP_ID, getIdentity);
  }
  if (base === 'local') {
    return new LocalStore(getIdentity);
  }
  if (import.meta.env.PROD) {
    return new HttpApi('/api', DEMO_TRIP_ID, getIdentity);
  }
  return new LocalStore(getIdentity);
}
