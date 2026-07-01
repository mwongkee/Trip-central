# TripBoard — Product & Stickiness Review (July 2026)

A complete pass over the app as deployed mid-trip (Nova Scotia, Jun 26 – Jul 5),
focused on one question: **what would make families open this app several times a
day during the trip — and come back to it after?**

## 1. What already works (don't break these)

- **Zero-friction join** (`JoinGate.tsx`): tap your name, no login. This is the
  app's superpower — every added step of auth would cost users.
- **Map-first browsing** with clustering, category emoji, legend, peek card —
  the core loop (see pin → peek → vote) is now 1–2 taps.
- **Swipe mode** for fast group voting; **2-tap scheduling** (`SchedulePicker`);
  **itinerary** that defaults to today with drive legs from the home base.
- **Per-device hide** with undo + review sheet — declutter without data loss.
- **Data safety posture is good**: additive seeding, PITR enabled on the table,
  optimistic-lock vote counters (drop bug fixed), CLAUDE.md guardrails.

The gaps below are almost all about **awareness** (what changed?), **in-trip
utility** (what should we do *right now*?), and **memory** (what did we do?).

## 2. Findings

### A. There is no reason to *re-open* the app (biggest stickiness gap)
- Nothing tells you what happened since your last visit. If Kristin votes on 4
  places and comments "kids loved this", nobody else ever finds out unless they
  happen to expand that card. Votes/comments are effectively write-only.
- The bundle only refetches on window focus (`queries.ts` — no polling, no
  push); there's no badge, digest, or feed anywhere.
- Comments are buried two taps deep, shown with absolute timestamps
  (`Comments.tsx` → `toLocaleString()`), with no preview on cards and no
  notification of replies.

**Consequence:** the app is a planning tool you visit when *you* want something,
not a shared space that pulls the family back. The pull-back loop is the single
highest-leverage thing missing.

### B. Mid-trip, the app doesn't answer "what should we do right now?"
- The Board opens on the full 440-place map; the Itinerary shows today's plan —
  but there's no **Today view** combining: today's plan + weather + "nothing
  planned this afternoon → here are 6 ideas ≤30 min away that the family voted
  for."
- Weather is the #1 trip re-planner and the app already has the `rainy-day` tag
  on ~40 places — but no weather signal to activate it.
- The swipe decks and distance presets are hard-coded to the Airbnb
  (`SwipeDeck.tsx`), and the hotel→Airbnb `CUTOVER` is a constant in
  `Itinerary.tsx`. Nothing flips automatically by date.
- Offline: there's a PWA manifest but **no service worker**. Rural South Shore
  (Kingsburg, the Ovens, Rissers) has weak cell coverage — exactly where the
  itinerary is most needed and where the app currently white-screens.

### C. Voting collects data but never *pays it off*
- 435+ places, hundreds of votes — but no ranking surface: no "Top picks",
  no "all 3 families agree on these 7", no per-family taste comparison.
- The natural end of the funnel — *"this is popular → schedule it"* — has no
  shortcut. (Vote data + `familyId` per voter already exist server-side.)

### D. Half-built features are dead weight
- **Expenses**: full API (`/expenses`), settle-up math (`settleUp` in
  `domain.ts`, unit-tested) — and **zero UI**. Splitting costs is a real
  mid-trip need and a strong reason to keep the app open; either ship a minimal
  UI or delete the code path.
- **Live location share** works but is buried in quick filters, and there's no
  "family radar" moment (e.g. on the itinerary map).

### E. Friction & polish
- Search is too fuzzy: "Disco" returns **100 results** (Fuse threshold too
  loose in `Board.tsx`), which reads as broken.
- 1.18 MB JS bundle, no code-splitting (MapLibre is most of it); with 442 seed
  items the trip bundle payload keeps growing. Fine today; worth a lazy-load
  split before adding more features.
- Photos: Wikipedia-match works for attractions, but most restaurants/shops are
  emoji tiles. Good (no fake photos) — but see "memories" below for the real
  fix.

### F. Nothing survives the trip (post-trip stickiness = 0)
- Items can be marked `done`, but there's no way to attach a photo or note of
  *your* visit, no trip recap, no shareable/printable itinerary. When the trip
  ends, the app's value drops to zero — even though it contains a complete,
  voted-on, commented history of the family's trip.

## 3. Highest-ROI changes (ranked)

| # | Change | Effort | Why it wins |
|---|--------|--------|-------------|
| 1 | **"What's new" digest** — on open, diff each item's `voteCount`/`commentCount`/`updatedAt` against a localStorage snapshot; show "🔔 5 new votes · 2 comments since yesterday" banner opening a small feed (tap → item). Client-only, no API change. | **S** | Creates the re-open loop with a day of work. The single best stickiness/effort ratio in the app. |
| 2 | **Today view** — make the itinerary's today panel the landing surface during trip dates: today's plan + gaps ("free afternoon") + top *voted, unscheduled* ideas within 30 min of the current base. | **M** | Answers the only question that matters mid-trip; turns votes into plans. |
| 3 | **Top picks / consensus board** — a ⭐ leaderboard preset: rank by votes, badge "all families in" when every family has a vote; one-tap 🗓 Plan from the list. | **S–M** | Pays off hundreds of already-cast votes; drives scheduling. |
| 4 | **Offline (service worker)** — precache the app shell + last bundle; cache map tiles opportunistically; queue votes/comments for replay. | **M** | The map/itinerary must work at Gaff Point with no bars. Directly protects the core use case. |
| 5 | **Weather-aware suggestions** — fetch Environment Canada forecast for the active base; rainy day → auto-surface `rainy-day`/indoor deck and flag outdoor plans. | **M** | Weather is the #1 replanning trigger; the tags already exist. |
| 6 | **Trip memories** — on `done` items let anyone attach a photo + note (S3 presigned upload); auto-build a day-by-day recap page at trip end. | **L** | The only feature that gives the app life *after* July 5 — and next-trip pull. |
| 7 | **Minimal expenses UI** — add expense from a place card, running per-family totals, settle-up screen (math already written & tested). | **M** | Real daily utility; API + math are already done, it's UI-only. |
| 8 | **Comment visibility** — relative times ("2 h ago"), 💬 count + latest-comment preview on cards/peek, comments included in the #1 digest. | **S** | Makes the social layer visible; cheap. |
| 9 | **Auto base cutover** — derive active base (hotel vs Airbnb) from the date everywhere (swipe decks, distance chips, Today view) instead of hard-coded centres. | **S** | Removes the "wrong city" class of confusion permanently. |
| 10 | **Search tuning** — tighten Fuse threshold/minMatchCharLength so "Disco" ≈ 3 results, not 100. | **S** | Perceived quality; 15 minutes of work. |

**Suggested order:** 1 → 3 → 8 → 10 → 9 (one small release, ~a few days, all
client-side) → then 2 + 5 together (Today view with weather) → 4 (offline)
→ 7 (expenses) → 6 (memories, post-trip).

## 4. Deliberately not recommended
- **Accounts/auth, chat, native apps** — they'd add friction or platform cost
  against the app's core advantage (instant, no-login, shared).
- **Real routing API for leg times** — the distance-scaled estimate is within
  ~15%; revisit only if plans hinge on exact timing.
- **More bulk place imports** — 442 places is past the browsing sweet spot;
  curation (Top picks, hide, decks) now beats volume.

## 5. Tech-health notes (do opportunistically)
- Code-split MapLibre / lazy-load Swipe & Itinerary (1.18 MB → target <500 KB
  initial).
- `buildItinerary` fallback slot `'unscheduled'` sorts oddly with the new
  chronological slot order — harmless, but unify slot ordering in one place.
- Presence polling (20 s) runs even when the tab shows no map; pause when
  hidden.
- Local demo mode (`localStore.ts`) has drifted behind the API (no resolve-map
  parity beyond full URLs, no presence TTL) — fine, but note it in CLAUDE.md if
  it's kept.
