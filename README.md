# TripBoard

A collaborative trip-planning web app for a family. People **join by typing their
name on a device** (no login), suggest **places** and **meals**, **vote — including
on behalf of their kids** — comment, schedule items across the next few days, mark
them done, defer suggestions to a later occasion, and (soon) track expenses.
Everything renders on a map + synced list and is searchable.

> Built from the spec in [`PROMPT.md`](./PROMPT.md) / [`PLAN.md`](./PLAN.md). The
> DynamoDB design + REST contract live in [`docs/data-model.md`](./docs/data-model.md).
> Deliberate choices and divergences are in [`DECISIONS.md`](./DECISIONS.md).

## Monorepo layout

```
packages/shared/   zod schemas + types + domain math + the family roster   (single source of truth)
services/api/      Node 20 Lambda: internal router + repo layer + DynamoDB single-table + transactions
apps/web/          React 18 + Vite SPA: join flow, map+list, family voting, comments, scheduling
scripts/seed.ts    seed a deployed table with the demo Nova Scotia trip + the three families
infra/             Terraform: DynamoDB + Lambda + HTTP API + S3 + CloudFront (the whole stack)
docs/              data model, setup-deploy runbook, data model reference
.github/workflows/ ci.yml (PRs), deploy.yml (main → terraform apply + ship SPA), seed.yml (manual)
```

## Run locally

No AWS needed — the SPA ships a local (in-browser) demo backend seeded with the trip
and the three families, so you can try the join + family-voting flow immediately.

```bash
npm install
npm run dev        # Vite dev server at http://localhost:5173
```

On first load you'll see the **join screen**: tap who you are (e.g. *Lewis*) or type a
new name. Open any place/meal and use **“Vote for your family”** to cast votes for
yourself and your kids — the score and voter list update live. Data is stored on your
device; use **Reset demo** in the header to reload the seed.

To run the SPA against a **deployed** API instead of the local demo:

```bash
VITE_API_BASE=https://<api-id>.execute-api.<region>.amazonaws.com/api npm run dev
```

### Quality gates

```bash
npm run typecheck   # tsc --noEmit across all workspaces
npm test            # vitest: domain math, repo keys, vote/comment transactions,
                    # the router (family voting), and the VoteControl component
npm run build       # builds shared + api (tsc) and the SPA (vite)
```

## Deploy

Everything is Terraform (`infra/`) driven by GitHub Actions over OIDC — DynamoDB,
Lambda, HTTP API, S3, and CloudFront in one `terraform apply`, then the SPA is built and
synced. CloudFront serves the SPA and proxies `/api/*` to the HTTP API (same origin → no
CORS); the SPA targets `/api` automatically in production.

**One-time setup** (state bucket, OIDC role + copy-paste IAM policies, repo variables) is
in **[`docs/setup-deploy.md`](./docs/setup-deploy.md)**. After that:

1. Merge to `main` (or run the **deploy** workflow) → full stack deploys, site URL is in
   the run summary.
2. Run the **seed** workflow once to load the demo trip + families.

Local Terraform (optional): `cd infra && terraform init -backend-config=... && terraform apply`.

## Auth model

This build uses a lightweight **device-join identity** (type your name, remembered on
the device) instead of Cognito sign-in, because that's how this family wanted it. The
Lambda also accepts Cognito JWT claims, so adding a JWT authorizer to the HTTP API in
`infra/apigw.tf` later is a small change. Details in [`DECISIONS.md`](./DECISIONS.md).

## Status by milestone

| Milestone | State |
|-----------|-------|
| M1 Core (places + meals + map/list + search) | ✅ working (map needs `VITE_MAP_STYLE`; address geocoding is a TODO) |
| M2 Social (family voting + comments + counters) | ✅ working end-to-end |
| M3 Scheduling (itinerary + done + defer) | ✅ data/API + basic UI |
| M4 Expenses | ⏳ shared settle-up math + API; no UI yet |
| M5 Anchors & polish (PWA offline, geocoding, a11y pass) | ⏳ anchors render + manifest; service worker + geocoding TODO |

See [`PLAN.md`](./PLAN.md) for acceptance criteria per milestone.
