# PROMPT.md — TripBoard build prompt

> Paste this whole file to your coding agent (e.g. Claude Code) at the repo root. It is the
> single source of truth for scaffolding the application. The DynamoDB table design and REST
> API contract live in `docs/data-model.md` — treat that file as authoritative for shapes and
> keys, and keep code in sync with it.

## Role & goal

You are building **TripBoard**, a small, production‑quality collaborative trip‑planning web
app for one family (≈4–10 adults, plus child profiles). It runs entirely on AWS: a static
SPA on S3 behind CloudFront, a serverless API (API Gateway HTTP API + Lambda), and a single
DynamoDB table. Optimize for low cost, low operational burden, and clean, well‑tested code —
not for scale beyond a few hundred items per trip.

## Core concept

The central object is an **Item**, which is one of two types:

- `PLACE` — somewhere to go (outdoor, museum, beach, playground, viewpoint, etc.) with a
  map location.
- `MEAL` — something to eat, tagged with a `mealType` (`breakfast` | `lunch` | `dinner` |
  `snack`) and optionally a place (restaurant) or "at the Airbnb".

Items move through statuses: `suggested → scheduled → done`, plus `skipped`. A scheduled item
has a `date` and a `slot`. **Meal occasions** are the pair `(date, mealType)`.

## Must‑have features

1. **Map + list, unified.** An interactive map (MapLibre GL JS, tiles/style from Amazon
   Location Service) showing all `PLACE` items and any `MEAL` items that have a location.
   A synced, filterable list beside/under it. Selecting in one highlights the other.
2. **Anchor places.** Items flagged `isAnchor` with `anchorRole` in {`airbnb`, `hotel`,
   `home`}. Rendered with distinct markers, pinned to the top of the list, and usable as the
   origin for "distance/time from here" on other items.
3. **Search.** Client‑side fuzzy search (Fuse.js) over the trip's items (title, description,
   tags, address). Separately, an **address search** box when adding a place, powered by the
   Amazon Location Place Index (geocoding) — picking a result drops the pin and fills the
   address.
4. **Suggestions.** Any member can suggest an item (creates it with status `suggested`).
   Suggestions are browsable per meal occasion and per place‑category, sorted by vote score.
5. **Voting, including on behalf of kids.** Each member can add **child profiles** they own.
   When voting, a parent casts a vote as themselves and/or as any of their children. A vote
   records `voterId`, `voterType` (`adult` | `child`), and `castByUserId` (audit). One vote
   per voter per item; default weight 1 each. Show a live score and who voted.
6. **Comments.** Threaded one level deep, per item, with author + timestamp.
7. **Scheduling + itinerary.** Assign an item to a `(date, slot)`; view a day‑by‑day
   itinerary for a date range ("the next few days"), grouped by date then slot/meal.
8. **Mark done & defer.** Mark scheduled items `done`. **Defer ("go out to a later meal"):**
   move a meal suggestion to the next occasion of the same `mealType` (or a chosen later
   date), preserving its votes and comments.
9. **Expenses.** Log an expense (amount in minor units, currency default `CAD`, category,
   `paidByUserId`, date, optional `linkedItemId`, `splitAmong` member list). Views: running
   total, by category, and a simple settle‑up (who owes whom) computed client‑side.

## Tech stack (use exactly this unless noted)

- **Frontend:** React 18 + TypeScript + Vite. Map: `maplibre-gl`. Search: `fuse.js`. Data
  fetching/cache: TanStack Query. Forms: react‑hook‑form + zod. Styling: CSS modules or
  Tailwind (your call; keep it lightweight and accessible). PWA manifest + offline shell so
  it's installable on a phone and the last‑loaded board is viewable offline.
- **Auth:** Amazon Cognito. User Pool for adults (email + password, hosted UI or Amplify
  Auth — minimal). Identity Pool to mint short‑lived credentials so the browser can call
  Amazon Location directly. API requests carry the User Pool JWT; API Gateway uses a JWT
  authorizer.
- **Backend:** Node.js 20 + TypeScript Lambda(s) behind an API Gateway **HTTP API**. Prefer a
  single Lambda with an internal router (e.g. `itty-router` or a tiny switch) to keep cold
  starts and IAM simple; split later only if needed. Use the AWS SDK v3 DynamoDB Document
  client. Validate every input with zod.
- **Data:** One DynamoDB table, on‑demand billing, with GSIs exactly as in
  `docs/data-model.md`. Maintain denormalized counters (`voteScore`, `voteCount`,
  `commentCount`) via `TransactWriteItems` so list views never fan‑out reads.
- **IaC:** AWS SAM template (`template.yaml`) that provisions the DynamoDB table, the Lambda +
  HTTP API + JWT authorizer, and their IAM roles (least privilege). Leave the S3 site bucket,
  CloudFront distribution, Cognito pools, and Location resources to either the console runbook
  (`docs/aws-console-setup.md`) or, optionally, additional SAM resources — but **read config
  (table name, user‑pool id, etc.) from environment variables**, never hard‑code ARNs.
- **Routing:** the SPA calls the API at a same‑origin path `/api/*`; CloudFront has a second
  origin (the API Gateway) for that path prefix, so there is **no CORS** in production. Still
  support a `VITE_API_BASE` for local dev against a deployed API.

## Repo structure to create

```
/                      # these bundle docs already here
  template.yaml        # SAM: DynamoDB + Lambda + HTTP API + authorizer
  package.json         # workspaces: apps/web, services/api, packages/shared
  apps/web/            # Vite React SPA
  services/api/        # Lambda handler(s) + router + repo layer
  packages/shared/     # zod schemas + TS types shared by web & api (single source for shapes)
  infra/               # any extra IaC + parameter docs
  .github/workflows/   # deploy.yml is provided; extend with a CI (lint+test) workflow
```

Put all entity/DTO types and zod schemas in `packages/shared` and import them in both `web`
and `api` so the contract can't drift.

## Implementation order

Build in the milestone order from `PLAN.md` (Core → Social → Scheduling → Expenses → Anchors
& polish). After each milestone: typecheck, run tests, and update the README's status.

## Quality bar

- TypeScript strict mode; no `any` in committed code.
- Unit tests for the repo layer (DynamoDB key construction + counter transactions) and the
  vote/expense math; component tests for the vote control and the itinerary view.
- Accessible: keyboard‑navigable list and map controls, visible focus, labelled inputs,
  `prefers-reduced-motion` respected, color is never the only signal (icons/labels too).
- Every Lambda input validated; consistent JSON error envelope `{ error: { code, message } }`.
- No secrets in code. Config via env vars / SSM. IAM least privilege.
- Seed script that loads a demo trip (the six Nova Scotia kid spots + an Airbnb anchor + a few
  meal suggestions) so the app is non‑empty on first run.

## Deliverables for this session

1. The repo scaffold above, compiling and passing `npm run build` + `npm test`.
2. `template.yaml` deploying cleanly with `sam build && sam deploy --guided`.
3. A `README` "Run locally" section (Vite dev server + SAM local or pointed at a dev API).
4. Milestone 1 (Core) fully working against a real deployed table; later milestones stubbed
   with TODOs that reference `PLAN.md`.

When a decision isn't specified here or in `docs/data-model.md`, choose the simplest option
that keeps cost and complexity low, and note it in `DECISIONS.md`.
