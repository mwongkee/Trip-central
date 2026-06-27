import type {
  Item,
  Vote,
  Comment,
  Expense,
  Member,
  ChildProfile,
  Trip,
  TripBundle,
  ItemDetail,
} from '@tripboard/shared';
import type { ItemFilter, Repo } from './repo.js';
import { NotFoundError } from './repo.js';

/**
 * In-memory Repo used by router tests (and handy for local dev). Mirrors the
 * counter-keeping semantics of DynamoRepo without DynamoDB.
 */
export class MemoryRepo implements Repo {
  trips = new Map<string, Trip>();
  members = new Map<string, Member>(); // key: tripId/userId
  children = new Map<string, ChildProfile>(); // key: tripId/childId
  items = new Map<string, Item>(); // key: tripId/itemId
  votes = new Map<string, Vote>(); // key: itemId/voterId
  comments = new Map<string, Comment>(); // key: itemId/commentId
  expenses = new Map<string, Expense>(); // key: tripId/expenseId

  seedTrip(trip: Trip): void {
    this.trips.set(trip.tripId, trip);
  }

  async getTripBundle(tripId: string): Promise<TripBundle | null> {
    const trip = this.trips.get(tripId);
    if (!trip) return null;
    return {
      trip,
      members: [...this.members.values()].filter((m) => m.tripId === tripId),
      children: [...this.children.values()].filter((c) => c.tripId === tripId),
      items: [...this.items.values()].filter((i) => i.tripId === tripId),
    };
  }

  async listItems(tripId: string, filter: ItemFilter = {}): Promise<Item[]> {
    return [...this.items.values()]
      .filter((i) => i.tripId === tripId)
      .filter((i) => !filter.type || i.type === filter.type)
      .filter((i) => !filter.status || i.status === filter.status)
      .filter((i) => !filter.bucket || (i.type === 'MEAL' ? i.mealType : i.category) === filter.bucket);
  }

  async getItem(tripId: string, itemId: string): Promise<Item | null> {
    return this.items.get(`${tripId}/${itemId}`) ?? null;
  }

  async putItem(item: Item): Promise<Item> {
    this.items.set(`${item.tripId}/${item.itemId}`, item);
    return item;
  }

  async deleteItem(tripId: string, itemId: string): Promise<void> {
    this.items.delete(`${tripId}/${itemId}`);
    for (const k of [...this.votes.keys()]) if (k.startsWith(`${itemId}/`)) this.votes.delete(k);
    for (const k of [...this.comments.keys()]) if (k.startsWith(`${itemId}/`)) this.comments.delete(k);
  }

  async getItemDetail(tripId: string, itemId: string): Promise<ItemDetail | null> {
    const item = await this.getItem(tripId, itemId);
    if (!item) return null;
    return {
      item,
      votes: [...this.votes.values()].filter((v) => v.itemId === itemId),
      comments: [...this.comments.values()].filter((c) => c.itemId === itemId),
    };
  }

  async getVote(itemId: string, voterId: string): Promise<Vote | null> {
    return this.votes.get(`${itemId}/${voterId}`) ?? null;
  }

  async castVote(tripId: string, vote: Vote): Promise<{ item: Item; vote: Vote }> {
    const item = await this.getItem(tripId, vote.itemId);
    if (!item) throw new NotFoundError('item not found');
    const existing = await this.getVote(vote.itemId, vote.voterId);
    const updated: Item = {
      ...item,
      voteScore: item.voteScore - (existing?.value ?? 0) + vote.value,
      voteCount: item.voteCount + (existing ? 0 : 1),
      updatedAt: vote.createdAt,
    };
    this.votes.set(`${vote.itemId}/${vote.voterId}`, vote);
    await this.putItem(updated);
    return { item: updated, vote };
  }

  async deleteVote(tripId: string, itemId: string, voterId: string, now: string): Promise<Item> {
    const item = await this.getItem(tripId, itemId);
    if (!item) throw new NotFoundError('item not found');
    const existing = await this.getVote(itemId, voterId);
    if (!existing) return item;
    this.votes.delete(`${itemId}/${voterId}`);
    const updated: Item = {
      ...item,
      voteScore: item.voteScore - existing.value,
      voteCount: Math.max(0, item.voteCount - 1),
      updatedAt: now,
    };
    await this.putItem(updated);
    return updated;
  }

  async listComments(itemId: string): Promise<Comment[]> {
    return [...this.comments.values()]
      .filter((c) => c.itemId === itemId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addComment(tripId: string, comment: Comment): Promise<{ item: Item; comment: Comment }> {
    const item = await this.getItem(tripId, comment.itemId);
    if (!item) throw new NotFoundError('item not found');
    this.comments.set(`${comment.itemId}/${comment.commentId}`, comment);
    const updated: Item = { ...item, commentCount: item.commentCount + 1 };
    await this.putItem(updated);
    return { item: updated, comment };
  }

  async listChildren(tripId: string): Promise<ChildProfile[]> {
    return [...this.children.values()].filter((c) => c.tripId === tripId);
  }

  async putChild(child: ChildProfile): Promise<ChildProfile> {
    this.children.set(`${child.tripId}/${child.childId}`, child);
    return child;
  }

  async deleteChild(tripId: string, childId: string): Promise<void> {
    this.children.delete(`${tripId}/${childId}`);
  }

  async listExpenses(tripId: string): Promise<Expense[]> {
    return [...this.expenses.values()].filter((e) => e.tripId === tripId);
  }

  async putExpense(expense: Expense): Promise<Expense> {
    this.expenses.set(`${expense.tripId}/${expense.expenseId}`, expense);
    return expense;
  }

  async deleteExpense(tripId: string, expenseId: string): Promise<void> {
    this.expenses.delete(`${tripId}/${expenseId}`);
  }

  async upsertMember(member: Member): Promise<Member> {
    this.members.set(`${member.tripId}/${member.userId}`, member);
    return member;
  }

  async getMember(tripId: string, userId: string): Promise<Member | null> {
    return this.members.get(`${tripId}/${userId}`) ?? null;
  }
}
