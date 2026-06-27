# docs/data-model.md — DynamoDB single‑table design & API contract

Authoritative source for table keys, item shapes, and the REST API. Keep code in sync with
this file.

## Table

- **Name:** `TripBoard` (env `TABLE_NAME`)
- **Billing:** on‑demand (PAY_PER_REQUEST)
- **Primary key:** `PK` (S, partition), `SK` (S, sort)
- **GSI1 (itinerary by date):** `GSI1PK` (S), `GSI1SK` (S) — projection: ALL
- **GSI2 (suggestions by bucket, scored):** `GSI2PK` (S), `GSI2SK` (S) — projection: ALL
- Stream: optional (enable NEW_AND_OLD_IMAGES later if you add notifications)

`<tripId>`, `<itemId>`, `<expenseId>`, `<commentId>`, `<childId>` are ULIDs/uuids.
`<userId>` is the Cognito `sub`. Dates are `YYYY-MM-DD`; timestamps are ISO‑8601.

## Item collections (PK / SK)

| Entity | PK | SK | Notes |
|--------|----|----|-------|
| Trip meta | `TRIP#<tripId>` | `META` | name, startDate, endDate, baseCurrency, timezone, inviteCode |
| Member | `TRIP#<tripId>` | `MEMBER#<userId>` | role, name, email, joinedAt |
| Child profile | `TRIP#<tripId>` | `CHILD#<childId>` | name, ownerUserId, avatarColor |
| **Item** | `TRIP#<tripId>` | `ITEM#<itemId>` | the main record (see fields below) |
| Vote | `ITEM#<itemId>` | `VOTE#<voterId>` | value, voterType, voterName, castByUserId, createdAt |
| Comment | `ITEM#<itemId>` | `COMMENT#<createdAt>#<commentId>` | text, authorUserId, authorName, parentCommentId? |
| Expense | `TRIP#<tripId>` | `EXPENSE#<createdAt>#<expenseId>` | amount, currency, category, paidByUserId, date, linkedItemId?, splitAmong[] |

**Item fields** (`PK=TRIP#<tripId>`, `SK=ITEM#<itemId>`):

```
entity:        "item"
itemId, tripId
type:          "PLACE" | "MEAL"
title, description
category:      e.g. "outdoor" | "museum" | "beach" | "playground" | "restaurant" | "lodging" | "other"
mealType:      "breakfast" | "lunch" | "dinner" | "snack"     # MEAL only
lat, lng, address                                            # PLACE, or located MEAL
isAnchor:      boolean
anchorRole:    "airbnb" | "hotel" | "home"                   # when isAnchor
status:        "suggested" | "scheduled" | "done" | "skipped"
scheduledDate: "YYYY-MM-DD"                                  # when scheduled
slot:          "morning" | "afternoon" | "evening" | mealType
estCost, currency
tags:          string[]
voteScore, voteCount, commentCount                          # denormalized counters
createdByUserId, createdAt, updatedAt
```

### Index projections written onto the Item

Set **GSI1** only when `status = "scheduled"`:

```
GSI1PK = "TRIP#<tripId>#SCHED"
GSI1SK = "<scheduledDate>#<slot>#ITEM#<itemId>"     # range-query a date window → itinerary
```

Set **GSI2** for browsable/suggested items (always, or while not done/skipped):

```
GSI2PK = "TRIP#<tripId>#<type>#<bucket>"
         # bucket = mealType for MEAL, category for PLACE
GSI2SK = "<scorePad>#ITEM#<itemId>"
         # scorePad = zero-padded (e.g. 9999 - voteScore) so ascending sort = highest score first
```

Recompute `GSI2SK` whenever `voteScore` changes.

## Access patterns

| # | Need | Query |
|---|------|-------|
| 1 | All items in a trip | `PK = TRIP#<tripId>` AND `begins_with(SK, "ITEM#")` |
| 2 | Trip bundle (meta+members+children+items) | `PK = TRIP#<tripId>` (single query, split by SK prefix) |
| 3 | Item detail with votes + comments | `PK = ITEM#<itemId>` (returns votes + comments; item meta from #1 or a `GetItem`) |
| 4 | Itinerary for a date range | GSI1: `GSI1PK = TRIP#<tripId>#SCHED` AND `GSI1SK BETWEEN "<from>" AND "<to>~"` |
| 5 | Top suggestions for a meal/category | GSI2: `GSI2PK = TRIP#<tripId>#MEAL#dinner` (already score‑sorted) |
| 6 | Expenses for a trip | `PK = TRIP#<tripId>` AND `begins_with(SK, "EXPENSE#")` |
| 7 | A member's children | `PK = TRIP#<tripId>` AND `begins_with(SK, "CHILD#")`, filter `ownerUserId` |

Search is **client‑side** (Fuse.js over the result of #1/#2). Address lookup when adding a
place uses the **Amazon Location Place Index**, not DynamoDB.

## Transactions (keep counters honest)

- **Cast/change vote:** `TransactWriteItems` = Put/Update the `VOTE#` record **and** `ADD`
  delta to the item's `voteScore` (+ recompute `GSI2SK`), `voteCount` as needed.
- **Add comment:** Put `COMMENT#` **and** `ADD 1` to `commentCount`.
- **Delete vote/comment:** reverse the above.
- **Defer a meal:** Update the item (`status="suggested"` or new `scheduledDate`), leaving its
  `VOTE#`/`COMMENT#` children untouched (same `ITEM#<itemId>` partition).

## REST API (API Gateway HTTP API, JWT‑authorized)

Base path `/api`. All routes require a valid Cognito User‑Pool JWT. Error envelope:
`{ "error": { "code": string, "message": string } }`.

```
GET    /api/health                                  → 200 {ok:true}

GET    /api/trips/{tripId}                           → trip meta + members + children
PATCH  /api/trips/{tripId}                           → update meta

GET    /api/trips/{tripId}/items?type=&status=&bucket=   → list/filter items
POST   /api/trips/{tripId}/items                     → create (suggest) item
PATCH  /api/trips/{tripId}/items/{itemId}            → edit / schedule / mark done / defer
DELETE /api/trips/{tripId}/items/{itemId}

POST   /api/trips/{tripId}/items/{itemId}/votes      → body {voterId, value}; upsert vote
DELETE /api/trips/{tripId}/items/{itemId}/votes/{voterId}

GET    /api/trips/{tripId}/items/{itemId}/comments
POST   /api/trips/{tripId}/items/{itemId}/comments   → body {text, parentCommentId?}

GET    /api/trips/{tripId}/children
POST   /api/trips/{tripId}/children                  → body {name, avatarColor}
DELETE /api/trips/{tripId}/children/{childId}

GET    /api/trips/{tripId}/expenses
POST   /api/trips/{tripId}/expenses
PATCH  /api/trips/{tripId}/expenses/{expenseId}
DELETE /api/trips/{tripId}/expenses/{expenseId}

GET    /api/trips/{tripId}/itinerary?from=YYYY-MM-DD&to=YYYY-MM-DD   → grouped by date→slot
```

### Schedule / done / defer via PATCH item

```jsonc
// schedule
{ "status": "scheduled", "scheduledDate": "2026-07-02", "slot": "dinner" }
// mark done
{ "status": "done" }
// defer a meal suggestion to the next dinner occasion (server resolves the next date)
{ "action": "defer", "toMealType": "dinner" }      // or { "action":"defer", "toDate":"2026-07-03" }
```

The server validates the caller is a trip member, recomputes any index attributes, and
returns the updated item.
