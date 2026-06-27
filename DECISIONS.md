# DECISIONS.md

Choices made while scaffolding TripBoard where `PROMPT.md` / `docs/data-model.md`
left room, plus the deliberate divergences requested for this family's trip.

## Identity: device "join", not Cognito email/password (requested)

The trip owner asked for: *"join and type in name and we can store my device, and
when we vote you can mark your family."* So instead of Cognito sign-in, a member
**joins by typing a name** (or tapping who they are from the seeded roster) and the
identity is **remembered on the device** (`localStorage`). This is a great fit for a
single family and removes all auth setup.

- Web stores `{ userId, name, familyId }` on the device (`apps/web/src/lib/identity.ts`).
- The SPA sends identity to the API as `x-tripboard-user` / `x-tripboard-name` headers.
- The Lambda reads those headers **or** Cognito JWT claims if a JWT authorizer is wired
  up (`services/api/src/handler.ts`), so the Cognito path in `PROMPT.md` remains an
  easy upgrade — add a JWT authorizer to the HTTP API in `infra/apigw.tf`.

Trade-off: device-join is not real authentication; anyone with the link can pick a
name. Acceptable for a private family trip. To harden further, enable a Cognito JWT
authorizer and drop the header fallback.

### Edge secret: the API only accepts traffic via CloudFront

To stop the (authorizer-less) HTTP API from being called directly, Terraform generates
a random secret (`infra/edge_secret.tf`) and injects it two ways: as a CloudFront origin
header `x-origin-verify` on the `/api/*` behavior, and as the Lambda's `EDGE_SECRET` env
var. The handler rejects any request whose header doesn't match (`services/api/src/edge.ts`,
constant-time compare). So requests must come through CloudFront; direct API Gateway hits
get `403`. The browser never sees the secret — CloudFront adds it server-side. When
`EDGE_SECRET` is unset (local dev, tests), the check is skipped.

## "Mark your family" voting (requested)

Each family is a household of **adults (Members)** + **kids (ChildProfiles)** grouped
by `familyId`. The vote control lists the joined user's household so a parent casts a
vote for themselves and/or each child in one place. Every vote records `voterId`,
`voterType`, and `castByUserId` (audit) exactly as the data model specifies. One vote
per voter per item; default weight 1.

## Family roster parsing

The roster was given as free text. Parsed as three families:

| Family | Adults | Kids |
|--------|--------|------|
| Lewis & Kristin | Lewis, Kristin | Emmett, Nico |
| Steve & Sarah | Steve, Sarah | Isaac, Alex, Jamie |
| Sergey & Alyssa | Sergey, Alyssa | Phillip, Sophia |

Ambiguity: the first family was written "Lewis Kristin the adults and Lewis Emmett
Nico kids". The repeated "Lewis" was read as the family/surname, **not** a third kid,
so the adults are Lewis + Kristin and the kids are Emmett + Nico. If Lewis should also
be a kid, add them in `packages/shared/src/families.ts` — that one file is the single
source for both the seed script and the web join screen.

## Local (no-AWS) demo mode

So `npm run dev` works with zero cloud setup, the SPA ships a `LocalStore`
(`localStorage`-backed) that mirrors the server's behavior, seeded with the demo trip
+ families. The same UI talks to the real `/api` in production. Selection logic is in
`apps/web/src/lib/api.ts`:

- `VITE_API_BASE` = a URL or `/api` → real backend.
- `VITE_API_BASE=local` or unset in dev → in-browser `LocalStore`.
- production build with nothing set → same-origin `/api` (the intended architecture).

## Single Lambda + hand-rolled router

Per the prompt, one Node 20 Lambda with an internal path router
(`services/api/src/router.ts`) instead of a framework, to keep cold starts and IAM
simple. The router is pure and testable with an in-memory repo
(`services/api/src/memory-repo.ts`).

## Counters via transactions

`voteScore` / `voteCount` / `commentCount` are denormalized on the Item and kept honest
with `TransactWriteItems`. Vote updates are **guarded on the current score** (optimistic
concurrency) with a small retry rather than blind `ADD`, so `GSI2SK` (the score-sorted
suggestion key) can be recomputed in the same transaction. Builders are pure functions
in `services/api/src/transactions.ts` and unit-tested.

## Defer ("go out to a later meal")

`PATCH item { action: "defer" }` either re-buckets the meal back to `suggested` for the
next occasion of the same `mealType`, or (`toDate`) reschedules it to that date. Votes
and comments are children of the same `ITEM#` partition, so they are preserved untouched.

## IaC: Terraform for the whole stack, deployed by GitHub Actions (OIDC)

`infra/` provisions **everything** — DynamoDB, Lambda, HTTP API, S3, and CloudFront — in
one `terraform apply`. Terraform references the API Gateway domain when building the
CloudFront `/api/*` behavior, so the SPA's same-origin `/api` works on the first deploy
with **no manual console step**. State lives in S3 with native locking (`use_lockfile`,
no DynamoDB lock table). CI assumes a scoped deploy role via GitHub OIDC — no stored
keys. One-time setup + copy-paste IAM is in `docs/setup-deploy.md`. (The original bundle
docs describe a SAM + console flow; Terraform replaces it here.)

## Milestone status

M1 (Core) and M2 (Social: family voting + comments) are fully working end-to-end in
local mode and against the API. M3 (scheduling/itinerary/defer) is implemented at the
data + API + basic-UI level. M4 (expenses) exists in the API + shared settle-up math
(unit-tested) but has no UI yet. M5 (anchors render distinctly; PWA manifest + offline
shell) is partial — address geocoding via Amazon Location and a service worker are the
main remaining TODOs, referenced in `PLAN.md`.
