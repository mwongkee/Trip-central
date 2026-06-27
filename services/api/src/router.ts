import { ulid } from 'ulid';
import { ZodError } from 'zod';
import {
  CreateItemInput,
  UpdateItemInput,
  CastVoteInput,
  CreateCommentInput,
  CreateChildInput,
  CreateExpenseInput,
  JoinInput,
  Item as ItemSchema,
  allVoters,
  buildItinerary,
} from '@tripboard/shared';
import type { Item, Vote, Comment, ChildProfile, Expense, Member } from '@tripboard/shared';
import { NotFoundError, type Repo } from './repo.js';

export interface Identity {
  userId: string;
  name: string;
}

export interface ApiRequest {
  method: string;
  /** Path WITHOUT the `/api` prefix, e.g. `/trips/t1/items`. */
  path: string;
  query: Record<string, string | undefined>;
  body: unknown;
  identity: Identity | null;
}

export interface ApiResponse {
  statusCode: number;
  body: unknown;
}

const json = (statusCode: number, body: unknown): ApiResponse => ({ statusCode, body });
const errorBody = (code: string, message: string) => ({ error: { code, message } });
const now = (): string => new Date().toISOString();

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** "morning" | "afternoon" | "evening" + meal types — used to slot scheduled items. */
const ALL_SLOTS = ['morning', 'afternoon', 'evening', 'breakfast', 'lunch', 'dinner', 'snack'];

export async function handleRequest(repo: Repo, req: ApiRequest): Promise<ApiResponse> {
  try {
    return await route(repo, req);
  } catch (err) {
    if (err instanceof HttpError) return json(err.statusCode, errorBody(err.code, err.message));
    if (err instanceof NotFoundError) return json(404, errorBody('NOT_FOUND', err.message));
    if (err instanceof ZodError) {
      return json(400, errorBody('VALIDATION', err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')));
    }
    // eslint-disable-next-line no-console
    console.error('unhandled error', err);
    return json(500, errorBody('INTERNAL', 'internal error'));
  }
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function requireIdentity(req: ApiRequest): Identity {
  if (!req.identity) throw new HttpError(401, 'UNAUTHENTICATED', 'join the trip first');
  return req.identity;
}

async function requireMember(repo: Repo, tripId: string, identity: Identity): Promise<Member> {
  const member = await repo.getMember(tripId, identity.userId);
  if (!member) throw new HttpError(403, 'NOT_A_MEMBER', 'not a member of this trip');
  return member;
}

async function route(repo: Repo, req: ApiRequest): Promise<ApiResponse> {
  const seg = segments(req.path);
  const { method } = req;

  // GET /health
  if (seg.length === 1 && seg[0] === 'health') return json(200, { ok: true });

  // /trips/...
  if (seg[0] !== 'trips' || seg.length < 2) {
    return json(404, errorBody('NOT_FOUND', `no route for ${method} ${req.path}`));
  }
  const tripId = seg[1]!;
  const rest = seg.slice(2);

  // GET/PATCH /trips/{tripId}
  if (rest.length === 0) {
    if (method === 'GET') {
      const bundle = await repo.getTripBundle(tripId);
      if (!bundle) throw new NotFoundError('trip not found');
      return json(200, bundle);
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
  }

  // POST /trips/{tripId}/join  — device join: type a name, claim/upsert a member
  if (rest.length === 1 && rest[0] === 'join' && method === 'POST') {
    const input = JoinInput.parse(req.body);
    const userId = input.userId ?? `user-${ulid().toLowerCase()}`;
    const existing = await repo.getMember(tripId, userId);
    const member: Member = {
      entity: 'member',
      tripId,
      userId,
      name: input.name,
      role: existing?.role ?? 'editor',
      familyId: input.familyId ?? existing?.familyId ?? `fam-${userId}`,
      familyName: existing?.familyName ?? input.name,
      joinedAt: existing?.joinedAt ?? now(),
    };
    await repo.upsertMember(member);
    return json(200, member);
  }

  // ---- items ----
  if (rest[0] === 'items') {
    return routeItems(repo, req, tripId, rest.slice(1));
  }

  // ---- children ----
  if (rest[0] === 'children') {
    return routeChildren(repo, req, tripId, rest.slice(1));
  }

  // ---- expenses ----
  if (rest[0] === 'expenses') {
    return routeExpenses(repo, req, tripId, rest.slice(1));
  }

  // ---- itinerary ----
  if (rest[0] === 'itinerary' && rest.length === 1 && method === 'GET') {
    const from = req.query['from'] ?? '0000-00-00';
    const to = req.query['to'] ?? '9999-99-99';
    const items = await repo.listItems(tripId);
    return json(200, { from, to, days: buildItinerary(items, from, to) });
  }

  return json(404, errorBody('NOT_FOUND', `no route for ${method} ${req.path}`));
}

async function routeItems(
  repo: Repo,
  req: ApiRequest,
  tripId: string,
  rest: string[],
): Promise<ApiResponse> {
  const { method } = req;

  // /items
  if (rest.length === 0) {
    if (method === 'GET') {
      const items = await repo.listItems(tripId, {
        type: req.query['type'],
        status: req.query['status'],
        bucket: req.query['bucket'],
      });
      return json(200, { items });
    }
    if (method === 'POST') {
      const identity = requireIdentity(req);
      await requireMember(repo, tripId, identity);
      const input = CreateItemInput.parse(req.body);
      const ts = now();
      const item = ItemSchema.parse({
        entity: 'item',
        itemId: ulid(),
        tripId,
        status: 'suggested',
        voteScore: 0,
        voteCount: 0,
        commentCount: 0,
        createdByUserId: identity.userId,
        createdAt: ts,
        updatedAt: ts,
        ...input,
      } satisfies Partial<Item>);
      await repo.putItem(item);
      return json(201, item);
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
  }

  const itemId = rest[0]!;

  // /items/{itemId}
  if (rest.length === 1) {
    if (method === 'PATCH') {
      const identity = requireIdentity(req);
      await requireMember(repo, tripId, identity);
      const input = UpdateItemInput.parse(req.body);
      const current = await repo.getItem(tripId, itemId);
      if (!current) throw new NotFoundError('item not found');
      const updated = applyItemUpdate(current, input);
      await repo.putItem(updated);
      return json(200, updated);
    }
    if (method === 'DELETE') {
      const identity = requireIdentity(req);
      await requireMember(repo, tripId, identity);
      await repo.deleteItem(tripId, itemId);
      return json(204, null);
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
  }

  // /items/{itemId}/votes ...
  if (rest[1] === 'votes') {
    return routeVotes(repo, req, tripId, itemId, rest.slice(2));
  }

  // /items/{itemId}/comments ...
  if (rest[1] === 'comments') {
    return routeComments(repo, req, tripId, itemId, rest.slice(2));
  }

  return json(404, errorBody('NOT_FOUND', `no route for ${method} ${req.path}`));
}

/** Apply edit / schedule / done / defer to an item, returning the new record. */
export function applyItemUpdate(current: Item, input: import('@tripboard/shared').UpdateItemInput): Item {
  const ts = now();

  if (input.action === 'defer') {
    const mealType = input.toMealType ?? current.mealType;
    if (input.toDate) {
      // Defer to a specific later date: schedule it there as that meal.
      return {
        ...current,
        status: 'scheduled',
        scheduledDate: input.toDate,
        slot: mealType ?? current.slot,
        mealType: mealType ?? current.mealType,
        updatedAt: ts,
      };
    }
    // Defer to the next occasion of the same meal: back to suggested, rebucketed. Votes/comments are kept.
    return {
      ...current,
      status: 'suggested',
      scheduledDate: undefined,
      slot: undefined,
      mealType: mealType ?? current.mealType,
      updatedAt: ts,
    };
  }

  const next: Item = { ...current, updatedAt: ts };
  if (input.title !== undefined) next.title = input.title;
  if (input.description !== undefined) next.description = input.description;
  if (input.category !== undefined) next.category = input.category;
  if (input.mealType !== undefined) next.mealType = input.mealType;
  if (input.lat !== undefined) next.lat = input.lat;
  if (input.lng !== undefined) next.lng = input.lng;
  if (input.address !== undefined) next.address = input.address;
  if (input.isAnchor !== undefined) next.isAnchor = input.isAnchor;
  if (input.anchorRole !== undefined) next.anchorRole = input.anchorRole;
  if (input.estCost !== undefined) next.estCost = input.estCost;
  if (input.tags !== undefined) next.tags = input.tags;
  if (input.scheduledDate !== undefined) next.scheduledDate = input.scheduledDate;
  if (input.slot !== undefined && ALL_SLOTS.includes(input.slot)) next.slot = input.slot;
  if (input.status !== undefined) {
    next.status = input.status;
    if (input.status !== 'scheduled') {
      // leaving scheduled state clears the schedule projection inputs
      if (input.status === 'suggested') {
        next.scheduledDate = undefined;
        next.slot = undefined;
      }
    }
  }
  return next;
}

async function routeVotes(
  repo: Repo,
  req: ApiRequest,
  tripId: string,
  itemId: string,
  rest: string[],
): Promise<ApiResponse> {
  const { method } = req;

  if (rest.length === 0 && method === 'POST') {
    const identity = requireIdentity(req);
    await requireMember(repo, tripId, identity);
    const input = CastVoteInput.parse(req.body);

    // Resolve who this voter is (adult member or child) from the trip roster.
    const bundle = await repo.getTripBundle(tripId);
    if (!bundle) throw new NotFoundError('trip not found');
    const voter = allVoters(bundle.members, bundle.children).find((v) => v.voterId === input.voterId);
    if (!voter) throw new HttpError(400, 'UNKNOWN_VOTER', 'voterId is not a member or child of this trip');

    const vote: Vote = {
      entity: 'vote',
      itemId,
      voterId: input.voterId,
      voterType: voter.type,
      voterName: voter.name,
      value: input.value,
      castByUserId: identity.userId,
      createdAt: now(),
    };
    const result = await repo.castVote(tripId, vote);
    return json(200, result);
  }

  // DELETE /votes/{voterId}
  if (rest.length === 1 && method === 'DELETE') {
    const identity = requireIdentity(req);
    await requireMember(repo, tripId, identity);
    const item = await repo.deleteVote(tripId, itemId, rest[0]!, now());
    return json(200, { item });
  }

  throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
}

async function routeComments(
  repo: Repo,
  req: ApiRequest,
  tripId: string,
  itemId: string,
  rest: string[],
): Promise<ApiResponse> {
  const { method } = req;
  if (rest.length !== 0) throw new HttpError(404, 'NOT_FOUND', 'no route');

  if (method === 'GET') {
    const comments = await repo.listComments(itemId);
    return json(200, { comments });
  }
  if (method === 'POST') {
    const identity = requireIdentity(req);
    await requireMember(repo, tripId, identity);
    const input = CreateCommentInput.parse(req.body);
    const comment: Comment = {
      entity: 'comment',
      itemId,
      commentId: ulid(),
      text: input.text,
      authorUserId: identity.userId,
      authorName: identity.name,
      parentCommentId: input.parentCommentId,
      createdAt: now(),
    };
    const result = await repo.addComment(tripId, comment);
    return json(201, result);
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
}

async function routeChildren(
  repo: Repo,
  req: ApiRequest,
  tripId: string,
  rest: string[],
): Promise<ApiResponse> {
  const { method } = req;

  if (rest.length === 0) {
    if (method === 'GET') return json(200, { children: await repo.listChildren(tripId) });
    if (method === 'POST') {
      const identity = requireIdentity(req);
      const member = await requireMember(repo, tripId, identity);
      const input = CreateChildInput.parse(req.body);
      const child: ChildProfile = {
        entity: 'child',
        tripId,
        childId: ulid(),
        name: input.name,
        ownerUserId: identity.userId,
        familyId: member.familyId,
        familyName: member.familyName,
        avatarColor: input.avatarColor ?? '#7c9cff',
      };
      await repo.putChild(child);
      return json(201, child);
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
  }

  if (rest.length === 1 && method === 'DELETE') {
    const identity = requireIdentity(req);
    await requireMember(repo, tripId, identity);
    await repo.deleteChild(tripId, rest[0]!);
    return json(204, null);
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
}

async function routeExpenses(
  repo: Repo,
  req: ApiRequest,
  tripId: string,
  rest: string[],
): Promise<ApiResponse> {
  const { method } = req;

  if (rest.length === 0) {
    if (method === 'GET') return json(200, { expenses: await repo.listExpenses(tripId) });
    if (method === 'POST') {
      const identity = requireIdentity(req);
      await requireMember(repo, tripId, identity);
      const input = CreateExpenseInput.parse(req.body);
      const ts = now();
      const expense: Expense = {
        entity: 'expense',
        expenseId: ulid(),
        tripId,
        amount: input.amount,
        currency: input.currency ?? 'CAD',
        category: input.category ?? 'other',
        description: input.description,
        paidByUserId: input.paidByUserId,
        date: input.date,
        linkedItemId: input.linkedItemId,
        splitAmong: input.splitAmong,
        createdAt: ts,
        updatedAt: ts,
      };
      await repo.putExpense(expense);
      return json(201, expense);
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
  }

  if (rest.length === 1) {
    const expenseId = rest[0]!;
    if (method === 'DELETE') {
      const identity = requireIdentity(req);
      await requireMember(repo, tripId, identity);
      // need createdAt to build the SK — read the row from the trip's expense list
      const existing = (await repo.listExpenses(tripId)).find((e) => e.expenseId === expenseId);
      if (!existing) throw new NotFoundError('expense not found');
      await repo.deleteExpense(tripId, expenseId, existing.createdAt);
      return json(204, null);
    }
    if (method === 'PATCH') {
      const identity = requireIdentity(req);
      await requireMember(repo, tripId, identity);
      const existing = (await repo.listExpenses(tripId)).find((e) => e.expenseId === expenseId);
      if (!existing) throw new NotFoundError('expense not found');
      const input = CreateExpenseInput.partial().parse(req.body);
      const updated: Expense = { ...existing, ...input, updatedAt: now() };
      await repo.putExpense(updated);
      return json(200, updated);
    }
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
  }
  throw new HttpError(405, 'METHOD_NOT_ALLOWED', `${method} not allowed`);
}
