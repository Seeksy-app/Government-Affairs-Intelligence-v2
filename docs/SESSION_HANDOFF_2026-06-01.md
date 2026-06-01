# Session Handoff — June 1, 2026 (End of Day)

> **Purpose:** This document briefs the next Claude chat on the state of GovAffairs Intelligence as of end-of-day Monday, June 1, 2026. Andrew used most of his 18-image limit in the previous chat shipping Morning Brief V1, so the next chat starts here. Read this entire document plus `CLAUDE.md` and `PRODUCT_STRATEGY.md` before doing any work.

---

## TL;DR for new Claude

Over Saturday-Monday (May 30 – June 1, 2026), Andrew shipped:
- **Decision Briefs V1** (Sat)
- **Press release ingestion pipeline** (Sun, 2 of 8 agencies live)
- **Morning Brief V1** — AI-ranked intelligence with client profiles, suggested contacts, one-click brief generation (Mon)
- **Dashboard redesign** with Morning Brief as hero, plus nav entry (Mon)

The product is genuinely usable. Adam Consulting Group (Andrew's first beta customer) hasn't yet responded to outreach asking for his 5 must-have agencies. The plan is to let Adam test what's built, then shape V2 from his feedback.

---

## Commits shipped today (June 1, 2026)

In chronological order:

| Hash | Description |
|---|---|
| `d4b4b92` | docs: MONDAY.md kickoff (created Sunday evening, truncated paste — full version rebuilt Monday) |
| `(Session 2)` | feat: press release HTML parsers + cron + block_reason column (built but parsers not landing records yet) |
| `9e18784` | feat: Morning Brief V1 — AI-ranked intelligence with client profiles, suggested contacts (beta), one-click brief generation with client context |
| `(Pending at handoff)` | feat: dashboard cleanup with Morning Brief hero + nav entry + deep-link to item detail |

**Sunday's commits (for context):**
- `d415c28` — Decision Briefs V1
- `165faa3` — PRODUCT_STRATEGY.md
- `c073678` — Press release ingestion Session 1 (DOL + NIST RSS)
- `7c2ddac` — Press releases list page

---

## What's actually live

### Working end-to-end
- **Decision Brief generation** — 5-section structured briefs from source URLs, with sensitivity (Internal/Shareable), client context, citations
- **Press release ingestion** — DOL (10 records) + NIST (40+ records) syncing via RSS with NewsBlur User-Agent
- **Auto-sync cron** — every 6 hours in production (NODE_ENV guarded, doesn't run in dev)
- **News Intelligence aggregation** — 70+ articles from VA News, DOD, Defense News, Politico, etc.
- **Press releases list page** — `/press-releases`, read-only table, sortable
- **Morning Brief page** — `/morning-brief`, AI-ranked items in 3 buckets (High Relevance ≥70, Worth Watching 40-69, ignored <40)
- **Morning Brief dashboard hero** — top 3 high-relevance items inline on `/dashboard`, deep-links to side panel
- **Client Profiles** — 4 profiles seeded (Adam Consulting Group + 3 demo clients: Veterans Benefits Coalition, Mid-Atlantic Infrastructure Partners, Northeast Healthcare Systems Alliance)
- **Suggested Contacts (beta)** — staffer matching from `legistorm_staffers` and `congressional_staff_directory` tables, with explicit beta label/tooltip
- **One-click intelligence-to-brief** — Click item → side panel → "Create Brief from This" → `/briefs/new` pre-populated with title, source URL, AND client context (industries, watchlist topics, why-it-matters reasoning)

### Built but not landing records
- **HTML parsers** for Treasury, DOJ, DOT, DHS — parsers exist, dispatch logic works, but Treasury rate-limits aggressively and other sources need debugging. Marked `is_active=true` in `government_press_sources` but returning 0 new records on sync.

### Deferred (blocked agencies)
- **EPA** — Cloudflare JS challenge (requires headless browser)
- **Commerce main** — 403 Cloudflare (NIST sub-agency covers some of it)
- **DOE** — Newsroom paths 404
- All marked `is_active=false` with `block_reason` populated

---

## Key files and paths (memorize these)

### Schema
- `shared/schema.ts` — Drizzle schema, tables: `users`, `clients`, `matters`, `briefs`, `brief_sources`, `brief_views`, `government_press_sources`, `government_press_releases`, `government_press_sync_runs`, `news_articles`, `legistorm_staffers`, `congressional_staff_directory`, `extracted_content`, `client_profiles` (added today)

### Services
- `server/services/brief-service.ts` — Decision Brief generation via Anthropic SDK
- `server/services/parallel-service.ts` — Parallel.ai Search + Extract APIs
- `server/services/government-press-service.ts` — Press release ingestion + scoring
- `server/services/morning-brief-service.ts` — Morning Brief ranking + suggested contacts

### Pages
- `client/src/pages/client-dashboard.tsx` — Main dashboard (redesigned today, Morning Brief hero)
- `client/src/pages/morning-brief.tsx` — Morning Brief full page with side panel
- `client/src/pages/press-releases.tsx` — Read-only press releases list
- `client/src/pages/briefs-new.tsx` — Brief creation form (accepts URL params for prefill)
- `client/src/pages/briefs-list.tsx`, `briefs-detail.tsx`, `brief-public.tsx`

### Scripts
- `script/seed-press-sources.ts` — Press release source seeding (full investigation comments)
- `script/seed-client-profiles.ts` — Client Profile seeding (4 profiles)
- `script/session1-closeout.ts`, `script/session2-setup.ts` — One-off session scripts

### Config
- `client/src/components/app-sidebar.tsx` — Nav structure (Morning Brief now under Intelligence above Press Releases)
- `client/src/App.tsx` — Routes
- `CLAUDE.md` — Project conventions and CC instructions
- `docs/PRODUCT_STRATEGY.md` — Product strategy (~4,500 words)
- `docs/MONDAY.md` — Monday kickoff (was truncated, full version on disk; pending re-commit)

---

## Critical IDs

| Entity | ID |
|---|---|
| Andrew (admin user) | `4194ef0b-9f88-4934-9eb0-69be3b818c04` |
| Adam Consulting Group (default impersonation) | `2cde8abd-7294-4493-b02a-3eac06f0d59e` |
| Veterans Benefits Coalition | *(in DB; check `clients` table)* |
| Mid-Atlantic Infrastructure Partners | `c2a8c95a-6d81-470f-a608-c620ed76a8a6` |
| Northeast Healthcare Systems Alliance | `54fafa7f-ac88-4fd4-b522-0e42b79ef699` |
| Supabase project | `wogcfejomgyjgbaosdyg` (us-west-2) |
| Vercel project | `prj_1kW8dRLyuruNHpJkaq9Tlqc5bYnm` |
| GitHub repo | `Seeksy-app/Government-Affairs-Intelligence-v2` |

### Login
- Email: `andrew@podlogix.co`
- Password: `Jayme2020!`
- bcrypt hash: `$2b$10$yM2HINWQ73nuNxRGa0ePWOIpfVXEAv5tjY7cTvm4weBeS3hpB/tAi`

---

## Architecture decisions made today

### Morning Brief design
- **Ranking via batched Claude call** — single API call scoring all items (cost-effective, ~$0.05/render with cache)
- **3-bucket scoring** — High Relevance ≥70, Worth Watching 40-69, Ignored <40
- **Honest scarcity** — when nothing scores ≥70, show empty state ("No urgent items today") instead of promoting low-scoring items. Fixed during build when initial fallback promoted score-10 items as "high relevance."
- **10-min in-memory cache** on the ranking endpoint to prevent burning credits on refreshes
- **Per-impersonated-client ranking** — uses existing impersonation flow, no new auth needed

### Data pipeline insight (important)
- Initial implementation filtered `news_articles` by `clientId`, which zeroed out all results for new demo clients (they have no historical associations)
- **Fix:** Removed `clientId` filter from the ranking query. All recent news goes through Claude's relevance filter regardless of historical assignment. Cleaner for shared-feed model.
- **Result:** Item count jumped from 6 to ~240, with multiple real high-relevance matches.

### Client Profile schema
- `client_profiles` table: `client_id`, `industries[]`, `watchlist_topics[]`, `relevant_agencies[]`, `relevant_committees[]`, `notes`
- Top-level relationship to `clients` (not nested under `matters`) for V1 simplicity
- Migration name: `0002_add_client_profiles.sql`

### Source category strategy
- Press releases are V1.5's primary unit
- News articles are integrated into Morning Brief ranking alongside press releases
- **Treasury, DOT, and other agencies also have Statements, Readouts, Testimonies categories** — not currently ingested. Speeches and testimony often precede press releases by days; high value but deferred to V2.
- Federal Register is in News Intelligence (don't double-ingest as press releases)

### Suggested Contacts (beta)
- Keyword matching on staffer titles against item content
- **Known weakness:** Returns IT/CIO staff for items with words like "Claim" or "Payment" or "Collection"
- Labeled "beta" with tooltip ("keyword-based, manual verification recommended")
- Real fix requires committee membership data joined to staffers — V2 work
- UI hides section entirely if matching returns empty

### Dashboard redesign
- Removed: weather header, chat input box, 4 quick-action buttons, 4 stat cards
- Kept: greeting, Prediction Markets (untouched), Quick Access
- Added: Morning Brief hero between greeting and Prediction Markets
- **Click any dashboard card → deep-links to Morning Brief with that item's side panel open** (via `?openItem={id}` query param)

---

## Adam status (THE most important context)

- **Texted Sunday morning** asking for 5 agencies he checks every morning + asking him to record answers to 5 workflow questions
- **No reply as of end-of-day Monday** (~30+ hours later)
- **Recommended action tomorrow:** Send second warm-ping text. Template:

  > "Hey — quick update. The morning intelligence feature is live. When you have 10 minutes this week I'd love to walk you through it and get your reaction. Especially curious which press releases you'd actually flag from what we surface. No rush on the 5 agencies thing — we can adjust based on what you see."

- Adam Consulting Group has been set up with a Client Profile spanning "veterans services, healthcare, infrastructure" (union of the 3 demo clients' areas)
- Adam can log in (or be shown in person) and immediately see Morning Brief working with real ranked content

---

## Open questions for V2 (decisions deferred)

### Architectural
1. **Client lens** — Should the dashboard show ALL clients' Morning Briefs at once (multi-client overview)? Or keep per-impersonated-client switching? Need Adam's actual workflow to decide.
2. **Drag-and-drop item-to-client assignment** — Andrew has instinct this matters. Don't build until Adam confirms multi-client tagging is his actual workflow.
3. **Source expansion** — Speeches, Testimony, Readouts, Statements from agency websites. High signal but more ingestion work. Schedule V2.
4. **Congress.gov API integration** — Bills, committee schedules, hearings as structured data (free API, key already exists in Vercel but "Needs Attention"). Cleaner than HTML scraping. V2 priority.

### Product
5. **Honest scarcity messaging** — When no high-relevance items today, current copy is "No urgent items today." Adam may want different framing.
6. **Real staffer matching** — Current keyword matching produces bad matches (IT/CIO for unrelated content). Need committee membership data joined to staffers. V2 architecture work.
7. **Reader annotation / two-way feedback** — Captured in Sunday's notes. Notion-style highlighting where lobbyist marks what client should read.
8. **Per-Client Contact Rolodex** — Lobbyists collect personal cell numbers through their own networks; product STORES rather than sources.
9. **Client Profile structure** — Currently industries/topics/agencies/committees as text arrays. May need richer structured fields (jurisdictions, key contacts, regulatory bodies). Wait for Adam to fill it in and see what's missing.

### Predictions Markets
10. Adam said "neat" but the markets shown are generic political markets (party chairs, foreign elections). To be valuable, they need to relate to lobbyist clients (filter by industry, surface market movements as signal). Scheduled for V1.5 or V2. **NOT TONIGHT.**

### Polish / known papercuts
11. `passwordHash` is still returned in `/api/auth/user` response (security paper cut, low urgency since no real customers yet)
12. Kalshi 429 rate limits during Prediction Markets polling — need backoff strategy
13. HTML parsers for Treasury/DOJ/DOT/DHS aren't landing records — debug or defer based on Adam's agency list
14. Vercel env vars marked "Needs Attention" need audit/rotation
15. Dashboard MONDAY.md is still the truncated 34-line version on disk and on GitHub. Full version rebuilt locally, may need re-commit.

---

## Lessons logged from today (and weekend)

These should be in `CLAUDE.md` — if they aren't, add them:

1. **env var values with parens** (like `NewsBlur Feed Fetcher - 1 subscriber (http://www.newsblur.com/)`) break shell parsing in `source .env`. **Always single-quote multi-word .env values.**
2. **CC's `npx tsx -e` and `node --eval` patterns leak Postgres connections and hang.** Use Supabase Dashboard SQL Editor for diagnostic queries instead.
3. **5-minute spinner = hang signal.** Don't wait 30 minutes hoping it recovers. Esc, diagnose, retry.
4. **Long nano pastes truncate silently.** For >50 line files, use bash heredoc or download-from-Claude-and-move method, not nano paste.
5. **Federal Register is already in News Intelligence.** Don't re-ingest as a press release source.
6. **Akamai (DOL) accepts `NewsBlur Feed Fetcher - 1 subscriber (http://www.newsblur.com/)` User-Agent.** Cloudflare JS challenge (EPA) does NOT — that needs a headless browser or different approach.
7. **The dashboard scroll jump.** When pasting long multi-section messages to CC, the terminal scroll can hide the new prompt. Confirm CC actually got the message by looking for the spinner / empty input box.
8. **Client lens is appealing but speculative.** Don't build "assign-to-client" workflows before Adam actually uses the product.

---

## Cost tracking (today only)

- Started with $19.00 in Anthropic API console
- Ended with **$17.70** after Morning Brief build, testing, dashboard redesign, deep-link fix
- **Total spend: $1.30** for the entire day's product work
- At ~$0.05/Morning Brief render (cached 10min), Adam testing for 2 weeks generating 10-15 briefs = projected <$5 spend

### Usage credits (Claude Code subscription)
- Sonnet 4.6 weekly budget: ~5% used at start of day
- Used through "Now using usage credits" mode for most CC work today (~$2-4 estimated from buffer)
- All Models weekly bucket still at 100% (Opus capped until reset)

### Other accounts
- Claude Code Max plan: subscription auth, Sonnet-only
- Supabase Pro: under quota
- Vercel: marketing site only (backend still local)

---

## Recommended FIRST PROMPT for new Claude chat

When you (the human) open a new chat tomorrow morning, paste this:

```
I'm Andrew, founder of GovAffairs Intelligence — a SaaS for 
lobbying/policy intelligence. I just had a long previous chat where 
I shipped Morning Brief V1 + Dashboard redesign with help from 
Claude Code. I have a turnover doc + project context I need you 
to read before we work.

Please read in this order:
1. /docs/SESSION_HANDOFF_2026-06-01.md (the turnover from yesterday)
2. /docs/PRODUCT_STRATEGY.md (the master strategy)
3. /docs/MONDAY.md (this week's plan)
4. /CLAUDE.md (project conventions for Claude Code)

After reading, tell me:
- Your understanding of current state in 4-5 bullets
- What you'd recommend as the highest-leverage next move
- Any questions before we start

Don't start coding until I approve a plan.

Today's energy: [describe your energy and goals]
Adam status: [did he reply? what did he say?]
```

---

## Anti-patterns the next Claude should refuse

1. Don't try to "make Predictions Markets fancier" without explicit scope and decision time. This was a tempting end-of-day rabbit hole.
2. Don't start building Option B (Daily Adam Brief / AI auto-curation) without Adam's actual recording data. Option A (Morning Brief) is the V1 of this concept.
3. Don't build a workflow builder. The product should have ONE good workflow (Morning Brief), not a tool for users to build their own.
4. Don't refactor existing working code unless asked. Briefs work. Press releases work. Morning Brief works. Leave them.
5. Don't pivot mid-session to chase new ideas (Congress.gov, Apollo, WorkOS, etc.). These are V2/V3 work.
6. Don't approve Drizzle migrations with DROP or RENAME without explicit human review.
7. Don't use `npx tsx -e` patterns for diagnostics. Use Supabase Dashboard SQL.

---

## What success looks like in Week 1 (June 2 – June 8)

- [ ] Adam logs in and uses Morning Brief for at least 2 real client briefs
- [ ] Adam provides feedback on relevance accuracy, missing sources, UX rough edges
- [ ] At least one more press release source landing records (currently 2: DOL + NIST)
- [ ] Honest evaluation: would Adam pay $500/month for this in its current form?
- [ ] V2 Client Context Profile schema refined based on what Adam actually filled in

NOT in Week 1 scope:
- Option B (AI auto-curation)
- Congress.gov integration
- Multi-customer onboarding
- Enterprise features (SSO, audit logs)
- Predictions Markets enhancement
- New marketing site changes

---

## Final note from outgoing chat

Andrew shipped a real product over Sat-Mon. The pattern that worked:
1. Strict milestone scoping with pause-and-report
2. Visual verification before approving commits
3. Saying NO to scope creep (Congress.gov, WorkOS, "fancier" Predictions, workflow builder)
4. Honest cost tracking
5. Resisting "one more thing" energy at the end of sessions

When that pattern breaks, things go badly: 30-minute hangs, sloppy code, decisions made by tired brains. Hold the line on scope discipline. Andrew is a Marine Corps Major — he'll respect direct pushback when it's earned.

End of handoff.
