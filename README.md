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
template.yaml      SAM: DynamoDB table + Lambda + HTTP API
docs/              data model, AWS console runbook, CI/CD
.github/workflows/ ci.yml (PRs: lint+typecheck+test+build) and deploy.yml (main → AWS)
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

## Deploy (summary)

1. Stand up the durable/edge resources once via
   [`docs/aws-console-setup.md`](./docs/aws-console-setup.md) (S3, CloudFront, IAM
   OIDC; Cognito/Location optional — see below).
2. The backend (DynamoDB + Lambda + HTTP API) is deployed by SAM:
   ```bash
   sam build && sam deploy --guided
   ```
3. Seed the demo trip into the table:
   ```bash
   TABLE_NAME=TripBoard AWS_REGION=ca-central-1 npm run seed
   ```
4. CI/CD: pushes to `main` run [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
   (backend via SAM, frontend → S3 + CloudFront). See [`docs/cicd.md`](./docs/cicd.md).

In production CloudFront serves the SPA and proxies `/api/*` to the HTTP API
(same origin → no CORS); the SPA defaults to `/api` automatically.

## Auth model

This build uses a lightweight **device-join identity** (type your name, remembered on
the device) instead of Cognito sign-in, because that's how this family wanted it. The
Lambda also accepts Cognito JWT claims, and `template.yaml` has the JWT authorizer
ready to uncomment, so moving to real sign-in later is a small change. Details in
[`DECISIONS.md`](./DECISIONS.md).

## Status by milestone

| Milestone | State |
|-----------|-------|
| M1 Core (places + meals + map/list + search) | ✅ working (map needs `VITE_MAP_STYLE`; address geocoding is a TODO) |
| M2 Social (family voting + comments + counters) | ✅ working end-to-end |
| M3 Scheduling (itinerary + done + defer) | ✅ data/API + basic UI |
| M4 Expenses | ⏳ shared settle-up math + API; no UI yet |
| M5 Anchors & polish (PWA offline, geocoding, a11y pass) | ⏳ anchors render + manifest; service worker + geocoding TODO |

See [`PLAN.md`](./PLAN.md) for acceptance criteria per milestone.
