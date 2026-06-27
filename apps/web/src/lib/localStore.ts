import {
  allVoters,
  type Trip,
  type Member,
  type ChildProfile,
  type Item,
  type Vote,
  type Comment,
  type TripBundle,
  type ItemDetail,
  type CreateItemInput,
  type UpdateItemInput,
  type JoinInput,
  type Presence,
} from '@tripboard/shared';
import { seedTrip, seedMembers, seedChildren, seedItems } from './seed.js';
import { ulid } from './ulid.js';
import type { DeviceIdentity } from './identity.js';

/**
 * A localStorage-backed store that mirrors the server's behavior so the SPA is fully
 * usable without AWS (great for the demo and `npm run dev`). The HTTP client in api.ts
 * speaks the same shape against the real backend. See DECISIONS.md.
 */

interface State {
  trip: Trip;
  members: Member[];
  children: ChildProfile[];
  items: Item[];
  votes: Record<string, Vote[]>;
  comments: Record<string, Comment[]>;
}

const KEY = 'tripboard.localstate.v1';

function freshState(): State {
  return {
    trip: seedTrip(),
    members: seedMembers(),
    children: seedChildren(),
    items: seedItems(),
    votes: {},
    comments: {},
  };
}

export class LocalStore {
  readonly mode = 'local' as const;
  private state: State;
  // Presence is ephemeral (not persisted); in local mode it's just you on this device.
  private presence: Presence | null = null;

  constructor(private readonly getIdentity: () => DeviceIdentity | null) {
    this.state = this.load();
  }

  private load(): State {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as State;
    } catch {
      /* fall through to fresh */
    }
    const s = freshState();
    this.persist(s);
    return s;
  }

  private persist(s: State = this.state): void {
    this.state = s;
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  /** Reset to the seeded demo (used by the "reset demo" control). */
  reset(): void {
    this.persist(freshState());
  }

  private requireIdentity(): DeviceIdentity {
    const id = this.getIdentity();
    if (!id) throw new Error('join the trip first');
    return id;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private recount(item: Item): Item {
    const votes = this.state.votes[item.itemId] ?? [];
    const comments = this.state.comments[item.itemId] ?? [];
    return {
      ...item,
      voteScore: votes.reduce((s, v) => s + v.value, 0),
      voteCount: votes.length,
      commentCount: comments.length,
    };
  }

  async getBundle(): Promise<TripBundle> {
    return {
      trip: this.state.trip,
      members: this.state.members,
      children: this.state.children,
      items: this.state.items.map((i) => this.recount(i)),
    };
  }

  async getDetail(itemId: string): Promise<ItemDetail> {
    const item = this.state.items.find((i) => i.itemId === itemId);
    if (!item) throw new Error('item not found');
    return {
      item: this.recount(item),
      votes: this.state.votes[itemId] ?? [],
      comments: (this.state.comments[itemId] ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  }

  async createItem(input: CreateItemInput): Promise<Item> {
    const id = this.requireIdentity();
    const ts = this.now();
    const item: Item = {
      entity: 'item',
      itemId: `item-${ulid()}`,
      tripId: this.state.trip.tripId,
      type: input.type,
      title: input.title,
      description: input.description,
      category: input.category,
      mealType: input.mealType,
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      imageUrl: input.imageUrl,
      website: input.website,
      isAnchor: input.isAnchor ?? false,
      anchorRole: input.anchorRole,
      status: 'suggested',
      currency: input.currency ?? 'CAD',
      tags: input.tags ?? [],
      estCost: input.estCost,
      voteScore: 0,
      voteCount: 0,
      commentCount: 0,
      createdByUserId: id.userId,
      createdAt: ts,
      updatedAt: ts,
    };
    this.state.items = [...this.state.items, item];
    this.persist();
    return item;
  }

  async updateItem(itemId: string, input: UpdateItemInput): Promise<Item> {
    this.requireIdentity();
    const item = this.state.items.find((i) => i.itemId === itemId);
    if (!item) throw new Error('item not found');
    const next = applyLocalUpdate(item, input, this.now());
    this.state.items = this.state.items.map((i) => (i.itemId === itemId ? next : i));
    this.persist();
    return this.recount(next);
  }

  async deleteItem(itemId: string): Promise<void> {
    this.requireIdentity();
    this.state.items = this.state.items.filter((i) => i.itemId !== itemId);
    delete this.state.votes[itemId];
    delete this.state.comments[itemId];
    this.persist();
  }

  async castVote(itemId: string, voterId: string, value: number): Promise<void> {
    const id = this.requireIdentity();
    const voter = allVoters(this.state.members, this.state.children).find((v) => v.voterId === voterId);
    if (!voter) throw new Error('unknown voter');
    const list = this.state.votes[itemId] ?? [];
    const vote: Vote = {
      entity: 'vote',
      itemId,
      voterId,
      voterType: voter.type,
      voterName: voter.name,
      value,
      castByUserId: id.userId,
      createdAt: this.now(),
    };
    this.state.votes[itemId] = [...list.filter((v) => v.voterId !== voterId), vote];
    this.persist();
  }

  async removeVote(itemId: string, voterId: string): Promise<void> {
    this.requireIdentity();
    this.state.votes[itemId] = (this.state.votes[itemId] ?? []).filter((v) => v.voterId !== voterId);
    this.persist();
  }

  async addComment(itemId: string, text: string, parentCommentId?: string): Promise<Comment> {
    const id = this.requireIdentity();
    const comment: Comment = {
      entity: 'comment',
      itemId,
      commentId: ulid(),
      text,
      authorUserId: id.userId,
      authorName: id.name,
      parentCommentId,
      createdAt: this.now(),
    };
    this.state.comments[itemId] = [...(this.state.comments[itemId] ?? []), comment];
    this.persist();
    return comment;
  }

  async sharePresence(lat: number, lng: number): Promise<void> {
    const id = this.requireIdentity();
    this.presence = {
      entity: 'presence',
      tripId: this.state.trip.tripId,
      userId: id.userId,
      name: id.name,
      familyId: id.familyId,
      lat,
      lng,
      updatedAt: this.now(),
    };
  }

  async stopPresence(): Promise<void> {
    this.presence = null;
  }

  async getPresence(): Promise<Presence[]> {
    return this.presence ? [this.presence] : [];
  }

  async join(input: JoinInput): Promise<Member> {
    const userId = input.userId ?? `user-${ulid().toLowerCase()}`;
    const existing = this.state.members.find((m) => m.userId === userId);
    const member: Member = existing ?? {
      entity: 'member',
      tripId: this.state.trip.tripId,
      userId,
      name: input.name,
      role: 'editor',
      familyId: input.familyId ?? `fam-${userId}`,
      familyName: input.name,
      joinedAt: this.now(),
    };
    if (!existing) {
      this.state.members = [...this.state.members, member];
      this.persist();
    }
    return member;
  }
}

/** Shared edit/schedule/done/defer logic for local mode (parallels the server's applyItemUpdate). */
export function applyLocalUpdate(current: Item, input: UpdateItemInput, ts: string): Item {
  if (input.action === 'defer') {
    const mealType = input.toMealType ?? current.mealType;
    if (input.toDate) {
      return { ...current, status: 'scheduled', scheduledDate: input.toDate, slot: mealType ?? current.slot, mealType: mealType ?? current.mealType, updatedAt: ts };
    }
    return { ...current, status: 'suggested', scheduledDate: undefined, slot: undefined, mealType: mealType ?? current.mealType, updatedAt: ts };
  }
  const next: Item = { ...current, updatedAt: ts };
  if (input.title !== undefined) next.title = input.title;
  if (input.description !== undefined) next.description = input.description;
  if (input.category !== undefined) next.category = input.category;
  if (input.mealType !== undefined) next.mealType = input.mealType;
  if (input.lat !== undefined) next.lat = input.lat;
  if (input.lng !== undefined) next.lng = input.lng;
  if (input.address !== undefined) next.address = input.address;
  if (input.imageUrl !== undefined) next.imageUrl = input.imageUrl;
  if (input.website !== undefined) next.website = input.website;
  if (input.isAnchor !== undefined) next.isAnchor = input.isAnchor;
  if (input.anchorRole !== undefined) next.anchorRole = input.anchorRole;
  if (input.estCost !== undefined) next.estCost = input.estCost;
  if (input.tags !== undefined) next.tags = input.tags;
  if (input.scheduledDate !== undefined) next.scheduledDate = input.scheduledDate;
  if (input.slot !== undefined) next.slot = input.slot;
  if (input.status !== undefined) next.status = input.status;
  if (input.status === 'suggested') {
    next.scheduledDate = undefined;
    next.slot = undefined;
  }
  return next;
}
