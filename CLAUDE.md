# CLAUDE.md — TripBoard

Guidance for working in this repo. **Read the "Data safety" rules before touching
seeding, the API, or the data model — they are the most important rules here.**

## What this is

TripBoard is a family trip-planning web app for a Nova Scotia 2026 trip, deployed
live on AWS. Families "join by typing their name on this device" (no login) and
vote ("mark your family"), comment, and suggest places. The map is the primary UI.

Live site: CloudFront distribution (see infra). Region us-east-1, account 150100643804.

## Repo layout (npm workspaces)

- `packages/shared` — zod schemas, domain math, family roster, **seed data** (`src/seeddata.ts`).
- `services/api` — Node 20 Lambda: internal router, single-table DynamoDB repo, edge-secret check.
- `apps/web` — React 18 + Vite + TypeScript SPA (MapLibre, TanStack Query).
- `infra` — Terraform (DynamoDB, Lambda, API Gateway HTTP API, S3, CloudFront).
- `scripts/seed.ts` — seeds the deployed DynamoDB table.

## ⚠️ Data safety — DO NOT LOSE OR CORRUPT USER DATA

Real families are voting, commenting, and suggesting on the live site. **Votes,
comments, and user-suggested items are irreplaceable.** Protect them:

1. **Seeding is ADDITIVE by default and must stay that way.** `scripts/seed.ts`
   inserts only items whose `itemId` does not already exist, upserts
   trip/members/children, and **syncs place metadata onto existing items via a
   DynamoDB `UpdateExpression` over `SYNC_FIELDS` only** (title, description,
   category, lat/lng, address, website, imageUrl, tags, anchor, type, mealType,
   estCost) — it must NEVER write `voteScore`/`voteCount`/`commentCount` or the
   user's `status`/`scheduledDate`/`slot`. Do NOT `put` (overwrite) an existing
   item — that resets the denormalized counts even though the vote rows remain,
   corrupting the score. Only a deliberate `SEED_RESET=1` run may wipe and rewrite.
   `RETIRED_ITEM_IDS` deletes named stale items (and their votes) intentionally.
2. **Never trigger a destructive seed on the live table.** Adding places = edit
   `seeddata.ts` (new `itemId`s only) → push → run the seed workflow (additive).
   Do NOT run with `SEED_RESET=1` against production unless the user explicitly
   asks to wipe everything and accepts losing all votes/comments.
3. **Votes/comments live under `PK = ITEM#<itemId>`** (see `services/api/src/keys.ts`);
   the item row lives under `PK = TRIP#<tripId>`. The detail read
   (`GET /items/{itemId}` → `repo.getItemDetail`) must keep returning votes +
   comments — if that route breaks, the UI silently shows "no votes" (this was a
   real bug; keep the route + its router test).
4. **Don't change existing `itemId`s.** They are the identity that ties votes/
   comments to a place. Renaming a title is fine; changing its `itemId` orphans
   its votes.
5. **Schema changes must be backward compatible.** Existing rows in DynamoDB were
   written with the old shape. New fields must be optional; don't remove/rename
   fields that existing rows rely on.

## Stability rules

- **Always** run `npm run build` (typechecks shared + api + web and builds web)
  and `npm test` before pushing. Don't push red.
- The web client's API layer degrades gracefully (e.g. `getDetail` falls back to
  bundle data). Keep fallbacks; don't let one failing request blank the app.
- Map markers are DOM markers; keep `iconFor`/`colorFor` pure. Photos resolve as
  real-URL → related Wikipedia image → emoji tile (never random stock).

## Deploy / seed flow

- Develop on branch `claude/family-voting-system-91cq2j`. Push there, and also
  `git push origin HEAD:main` to deploy (the `deploy.yml` workflow runs on main).
- **Code/UI changes:** push to main → deploy. No seed needed.
- **Data changes (`seeddata.ts`):** push to main → then run the `seed.yml`
  workflow on main (additive — preserves votes). Verify both `deploy` and `seed`
  runs conclude `success`.
- Doc-only changes (e.g. `docs/`, this file): push to the feature branch only; no
  need to deploy.
- `mcp__github__actions_list` output can exceed the token limit — it's saved to a
  file; parse with `python3`.

## Commands

```
npm run build      # typecheck all + build web
npm test           # vitest across workspaces
npm run -w @tripboard/shared test
npm run seed       # additive seed (needs TABLE_NAME, AWS creds); SEED_RESET=1 to wipe
```

## How to add a place (follow every step)

1. **Unique id:** `item-<slug>` that never changes (votes/comments key off it).
   Check it isn't already present (`grep "place('item-"` / dedupe before pushing).
2. **Accurate coordinates — do NOT drop pins in the water.** Verify lat/lng on a
   real map (Google/OSM), not a guess. Nova Scotia is lat ~43.4–47, lng ~−66 to
   −59.5 (negative!). Halifax ≈ 44.65, −63.57. The downtown **boardwalk is ≈ lng
   −63.570**; anything east of ~−63.568 lands in the harbour. If unsure, use the
   in-app Add form (OpenStreetMap search / paste a Maps link) to get exact coords.
3. **No fake/stock photos.** Leave `imageUrl` unset — the UI shows a real
   Wikipedia photo when one matches, else a category emoji tile. Only set
   `imageUrl` to a genuine, place-specific photo URL. Never picsum/stock.
4. **Proper categorization:** pick the right `category` (outdoor, museum, beach,
   playground, viewpoint, restaurant, lodging, landmark, activity, shopping,
   other) and add `tags` from: `kids`, `walkable`, `tonight`, `trails`, `beach`,
   `daytrip`, `rainy-day`, `stroller-friendly`. Add a `website` when known.
   Keep `apps/web` `CATEGORY_COLORS`, `iconFor`, and the Add-form list in sync if
   you add a category.
5. **Ship:** `npm run build` + `npm test` → push to main → run the `seed.yml`
   workflow (additive sync; preserves votes). To remove a mistake, add its id to
   `RETIRED_ITEM_IDS` in `scripts/seed.ts`.

## Conventions

- See `docs/BACKLOG.md` for queued content sources and feature ideas.
