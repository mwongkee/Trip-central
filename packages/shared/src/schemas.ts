import { z } from 'zod';

/**
 * Zod schemas + inferred types shared by web and api so the contract can't drift.
 * Mirrors docs/data-model.md — keep in sync with that file.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ItemType = z.enum(['PLACE', 'MEAL']);
export type ItemType = z.infer<typeof ItemType>;

export const MealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export type MealType = z.infer<typeof MealType>;

export const ItemStatus = z.enum(['suggested', 'scheduled', 'done', 'skipped']);
export type ItemStatus = z.infer<typeof ItemStatus>;

export const Slot = z.enum([
  'morning',
  'afternoon',
  'evening',
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]);
export type Slot = z.infer<typeof Slot>;

export const AnchorRole = z.enum(['airbnb', 'hotel', 'home']);
export type AnchorRole = z.infer<typeof AnchorRole>;

export const Category = z.enum([
  'outdoor',
  'museum',
  'beach',
  'playground',
  'viewpoint',
  'restaurant',
  'lodging',
  'other',
]);
export type Category = z.infer<typeof Category>;

export const VoterType = z.enum(['adult', 'child']);
export type VoterType = z.infer<typeof VoterType>;

export const MemberRole = z.enum(['owner', 'editor', 'viewer']);
export type MemberRole = z.infer<typeof MemberRole>;

export const ExpenseCategory = z.enum([
  'groceries',
  'dining',
  'lodging',
  'activities',
  'transport',
  'other',
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const Trip = z.object({
  entity: z.literal('trip'),
  tripId: z.string(),
  name: z.string(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  baseCurrency: z.string().default('CAD'),
  timezone: z.string().default('America/Halifax'),
  inviteCode: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trip = z.infer<typeof Trip>;

export const Member = z.object({
  entity: z.literal('member'),
  tripId: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string().optional(),
  role: MemberRole.default('editor'),
  /** Family grouping so a member can vote on behalf of their household. */
  familyId: z.string(),
  familyName: z.string(),
  joinedAt: z.string(),
});
export type Member = z.infer<typeof Member>;

export const ChildProfile = z.object({
  entity: z.literal('child'),
  tripId: z.string(),
  childId: z.string(),
  name: z.string(),
  ownerUserId: z.string(),
  familyId: z.string(),
  familyName: z.string(),
  avatarColor: z.string().default('#7c9cff'),
});
export type ChildProfile = z.infer<typeof ChildProfile>;

export const Item = z.object({
  entity: z.literal('item'),
  itemId: z.string(),
  tripId: z.string(),
  type: ItemType,
  title: z.string().min(1),
  description: z.string().optional(),
  category: Category.optional(),
  mealType: MealType.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  imageUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  isAnchor: z.boolean().default(false),
  anchorRole: AnchorRole.optional(),
  status: ItemStatus.default('suggested'),
  scheduledDate: isoDate.optional(),
  slot: Slot.optional(),
  estCost: z.number().int().nonnegative().optional(),
  currency: z.string().default('CAD'),
  tags: z.array(z.string()).default([]),
  voteScore: z.number().int().default(0),
  voteCount: z.number().int().default(0),
  commentCount: z.number().int().default(0),
  createdByUserId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Item = z.infer<typeof Item>;

export const Vote = z.object({
  entity: z.literal('vote'),
  itemId: z.string(),
  voterId: z.string(),
  voterType: VoterType,
  voterName: z.string(),
  value: z.number().int(),
  /** Audit: which signed-in/device user actually entered this vote. */
  castByUserId: z.string(),
  createdAt: z.string(),
});
export type Vote = z.infer<typeof Vote>;

export const Comment = z.object({
  entity: z.literal('comment'),
  itemId: z.string(),
  commentId: z.string(),
  text: z.string().min(1),
  authorUserId: z.string(),
  authorName: z.string(),
  parentCommentId: z.string().optional(),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof Comment>;

export const Expense = z.object({
  entity: z.literal('expense'),
  expenseId: z.string(),
  tripId: z.string(),
  /** Amount in minor units (cents). */
  amount: z.number().int().nonnegative(),
  currency: z.string().default('CAD'),
  category: ExpenseCategory.default('other'),
  description: z.string().optional(),
  paidByUserId: z.string(),
  date: isoDate,
  linkedItemId: z.string().optional(),
  splitAmong: z.array(z.string()).min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Expense = z.infer<typeof Expense>;

// ---------------------------------------------------------------------------
// Request DTOs (inputs validated on the server)
// ---------------------------------------------------------------------------

export const CreateItemInput = z
  .object({
    type: ItemType,
    title: z.string().min(1),
    description: z.string().optional(),
    category: Category.optional(),
    mealType: MealType.optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional(),
    imageUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    isAnchor: z.boolean().optional(),
    anchorRole: AnchorRole.optional(),
    estCost: z.number().int().nonnegative().optional(),
    currency: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .refine((v) => v.type !== 'MEAL' || !!v.mealType, {
    message: 'mealType is required for MEAL items',
    path: ['mealType'],
  });
export type CreateItemInput = z.infer<typeof CreateItemInput>;

export const UpdateItemInput = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: Category.optional(),
  mealType: MealType.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  imageUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  isAnchor: z.boolean().optional(),
  anchorRole: AnchorRole.optional(),
  status: ItemStatus.optional(),
  scheduledDate: isoDate.optional(),
  slot: Slot.optional(),
  estCost: z.number().int().nonnegative().optional(),
  tags: z.array(z.string()).optional(),
  // defer action
  action: z.literal('defer').optional(),
  toMealType: MealType.optional(),
  toDate: isoDate.optional(),
});
export type UpdateItemInput = z.infer<typeof UpdateItemInput>;

export const CastVoteInput = z.object({
  voterId: z.string(),
  value: z.number().int().min(-1).max(1).default(1),
});
export type CastVoteInput = z.infer<typeof CastVoteInput>;

export const CreateCommentInput = z.object({
  text: z.string().min(1),
  parentCommentId: z.string().optional(),
});
export type CreateCommentInput = z.infer<typeof CreateCommentInput>;

export const CreateChildInput = z.object({
  name: z.string().min(1),
  avatarColor: z.string().optional(),
});
export type CreateChildInput = z.infer<typeof CreateChildInput>;

export const JoinInput = z.object({
  name: z.string().min(1),
  /** Optional: claim an existing seeded member by id. */
  userId: z.string().optional(),
  familyId: z.string().optional(),
});
export type JoinInput = z.infer<typeof JoinInput>;

export const Presence = z.object({
  entity: z.literal('presence'),
  tripId: z.string(),
  userId: z.string(),
  name: z.string(),
  familyId: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  updatedAt: z.string(),
});
export type Presence = z.infer<typeof Presence>;

export const SharePresenceInput = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type SharePresenceInput = z.infer<typeof SharePresenceInput>;

export const CreateExpenseInput = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().optional(),
  category: ExpenseCategory.optional(),
  description: z.string().optional(),
  paidByUserId: z.string(),
  date: isoDate,
  linkedItemId: z.string().optional(),
  splitAmong: z.array(z.string()).min(1),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface TripBundle {
  trip: Trip;
  members: Member[];
  children: ChildProfile[];
  items: Item[];
}

export interface ItemDetail {
  item: Item;
  votes: Vote[];
  comments: Comment[];
}

export interface ApiError {
  error: { code: string; message: string };
}
