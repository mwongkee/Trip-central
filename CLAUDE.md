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
   inserts only items whose `itemId` does not already exist, and upserts
   trip/members/children. It must NOT delete the trip partition and must NOT
   re-`put` existing items (re-putting resets the denormalized `voteScore`/
   `voteCount`/`commentCount` to 0 even though the vote rows still exist — that
   corrupts the score). Only a deliberate `SEED_RESET=1` run may wipe and rewrite.
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

## Conventions

- Categories (`packages/shared/src/schemas.ts`): outdoor, museum, beach,
  playground, viewpoint, restaurant, lodging, landmark, activity, shopping, other.
  Keep `apps/web` `CATEGORY_COLORS`, `iconFor`, and the Add form list in sync.
- Adding places: give each a unique `item-<slug>` id, a category, lat/lng, tags
  (`kids`, `walkable`, `tonight`, `trails`, `beach`, `daytrip`, `rainy-day`,
  `stroller-friendly`), and a `website` when known.
- See `docs/BACKLOG.md` for queued content sources and feature ideas.
