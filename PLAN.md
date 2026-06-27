# PLAN.md — TripBoard

## 1. Architecture

```
                         ┌────────────────────────────┐
                         │        CloudFront           │  custom domain + ACM (us-east-1)
                         │  (single distribution)      │  SPA error routing 403/404→/index.html
                         └────────────┬───────┬────────┘
                       default behavior│       │ /api/* behavior
                                       ▼       ▼
                            ┌──────────────┐  ┌──────────────────────┐
                            │ S3 (private) │  │ API Gateway HTTP API  │
                            │  OAC, SPA    │  │  + Cognito JWT authz   │
                            └──────────────┘  └──────────┬───────────┘
                                                         ▼
                                              ┌──────────────────────┐
                                              │ Lambda (Node20 / TS)  │
                                              │ router + repo layer    │
                                              └──────────┬───────────┘
                                                         ▼
                                              ┌──────────────────────┐
                                              │ DynamoDB single table │  on-demand, GSI1, GSI2
                                              └──────────────────────┘

  Browser also talks directly to:
   • Amazon Cognito (User Pool sign-in; Identity Pool → temp creds)
   • Amazon Location Service (Map tiles/style + Place Index geocoding) using those creds
```

Why this shape: it's the cheapest durable way to run a CRUD‑plus‑map app — static hosting at
the edge, pay‑per‑request compute and storage, managed auth, and managed maps so you carry no
tile server or geocoder. Same‑origin `/api/*` removes CORS. Single table keeps reads to one
round trip per view.

## 2. Infra: console vs IaC

You asked for **AWS‑console setup + CI/CD deploys**, so the runbook in
`docs/aws-console-setup.md` is console‑first for the durable/edge resources (S3, CloudFront,
Cognito, Location, IAM OIDC). The **application backend** (DynamoDB table, Lambda, HTTP API)
is provisioned by a **SAM template** in the repo and deployed by CI/CD — that's far less
error‑prone than clicking Lambdas, and it's what the build prompt generates.

Graduation path (recommended once it's stable): move the console‑created resources into IaC
too. Since you already run **Terraform** comfortably, a single Terraform stack for S3 +
CloudFront + Cognito + Location is a natural fit and removes console drift; keep SAM (or fold
it into Terraform) for the serverless bits. Not required for v1.

> Note: AWS console labels and flows change over time. Treat the runbook as a map, not a
> transcript — if a field is named slightly differently, follow the current console wording
> and the linked AWS docs.

## 3. Data model (summary)

Full detail, keys, and access patterns are in `docs/data-model.md`. Entities:

- **Trip** (meta, dates, base currency, invite code)
- **Member** (adult, from Cognito; role owner/editor/viewer)
- **ChildProfile** (owned by a member; a votable identity, does not sign in)
- **Item** (`PLACE` | `MEAL`; status, optional location, anchor flag, schedule, est. cost,
  denormalized `voteScore`/`voteCount`/`commentCount`)
- **Vote** (per item per voter; `voterType` adult|child; `castByUserId` for audit)
- **Comment** (per item; one‑level threads)
- **Expense** (amount, currency, category, payer, split, optional link to an item)

One DynamoDB table, on‑demand. `GSI1` powers the date‑range itinerary; `GSI2` powers
"suggestions by meal/category, sorted by score." Counters are kept consistent with
`TransactWriteItems`.

## 4. Key product decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Kids voting | Parents proxy via child profiles; 1 vote each, weight configurable | No kid logins to manage; preserves "everyone gets a say" while an adult enters it. |
| Search | Client‑side Fuse.js over loaded items; Location Place Index only for adding addresses | A trip has hundreds of items, not millions — OpenSearch would be cost/ops overkill. |
| "Go out to later meals" | A `defer` action that re‑slots a meal suggestion to the next `(date, mealType)` occasion, keeping votes/comments | Matches how families actually reuse ideas that didn't get picked. |
| Backend shape | One Lambda + internal router | Simplest IAM and lowest cold‑start surface at this size; split later if a route gets hot. |
| Maps | Amazon Location + MapLibre | Stays in‑ecosystem, no third‑party key, geocoding included. |
| Frontend | Vite SPA (not Next.js) | No SSR needed; static on S3/CloudFront is simplest. (A Next.js static export would also work given your familiarity, but adds nothing here.) |
| Money | Store amounts as integer minor units; settle‑up computed client‑side | Avoids float drift; settle‑up is trivial at family scale. |

## 5. Milestones (with acceptance criteria)

**M0 — Bootstrap.** Repo scaffold, SAM table+API deploy, console resources stood up, CI/CD
green on a no‑op. *Done when:* a pushed commit deploys an empty SPA to the CloudFront URL and
`GET /api/health` returns 200 through CloudFront.

**M1 — Core (places + meals + map + search).** Auth; create/list/edit/delete items of both
types; map with markers; synced filterable list; client‑side search; address geocoding when
adding a place; seed demo trip. *Done when:* a signed‑in user can add a place by searching an
address, add a meal, see both on the map/list, and find them via search.

**M2 — Social (voting + comments).** Child profiles; vote control that lets a parent cast for
self and children; live score + voter list; one‑level comments; counters via transactions.
*Done when:* a parent casts votes for two kids and themselves, score reflects 3, and reloading
shows the same; comments post and display with author/time.

**M3 — Scheduling (itinerary + done + defer).** Assign `(date, slot)`; day‑by‑day itinerary
for a range; mark done; defer a meal suggestion to the next occasion. *Done when:* the next‑3‑
days view groups scheduled items correctly and a deferred meal reappears under the later
occasion with its votes intact.

**M4 — Expenses.** Log/edit/delete expenses; totals by category; settle‑up. *Done when:* three
expenses with different payers and splits produce a correct who‑owes‑whom summary.

**M5 — Anchors & polish.** Airbnb/hotel anchors with distinct markers + "distance from anchor";
PWA install + offline shell; accessibility pass; empty/error states. *Done when:* the Airbnb
pin anchors distances, the app installs on a phone, and Lighthouse PWA + a11y are green.

## 6. Cost estimate (one family, one trip)

Essentially free‑tier territory. Rough monthly while in active use:

- DynamoDB on‑demand: a few hundred items + votes/comments → **< $1**.
- Lambda + API Gateway HTTP API: thousands of requests → **~$0** (within/near free tier).
- S3 + CloudFront: small assets, low traffic → **~$0.50–$1**.
- Cognito: free under 50k MAU → **$0**.
- Amazon Location: charged per 1k map tiles + per 1k geocode requests; casual family use →
  **~$0–$2**.

Plan for **~$1–5/month** in active months, near‑zero when idle. The main "gotcha" to watch is
Amazon Location map‑tile requests if the map is left open for long sessions — cache the style
and avoid unnecessary re‑inits.

## 7. Risks / watch‑items

- **Counter drift** if a vote/comment write isn't transactional — always pair the child write
  with the parent counter update in one `TransactWriteItems`.
- **CloudFront SPA routing** — set custom error responses (403 & 404 → `/index.html`, 200) or
  deep links break.
- **ACM region** — the CloudFront certificate must be requested in **us‑east‑1** regardless of
  where everything else lives.
- **OIDC trust scope** — restrict the GitHub deploy role's trust policy to your exact repo (and
  ideally `ref:refs/heads/main`) so other repos can't assume it.
