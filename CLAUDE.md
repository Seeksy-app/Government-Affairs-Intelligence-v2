# Government Affairs Intelligence — Engineering Reference

## Business Model
Government affairs / legislative intelligence platform for lobbying firms and
in-house teams. Monitors Congress, staffers, regulatory activity, and political
trading signals. The two flagship jobs:
1. **"Should I be worried?"** — a client sees a scary headline; the lobbyist
   answers in minutes with a calm, cited brief (Decision Briefs + Morning Brief).
2. **"Build the path"** — find the route to a legislator through staffers,
   shared history, and events (directory + future path-builder).

Tenancy naming (important): `clients` = the lobbying FIRM (SaaS licensee);
`client_users` = firm staff; `customers` = the firm's targets/end-clients;
`client_portals` = external client-facing portals; `client_profiles` = 1:1 with
`clients`, drives Morning Brief scoring (industries, watchlistTopics,
relevantAgencies, relevantCommittees).

## Domains & Hosting (current as of 2026-09-24)
| Surface | URL | Host |
|---|---|---|
| Marketing landing (V0-built, separate codebase) | governmentaffairs.io (+ www) | Vercel project `government-affairs` (team `podlogix`) |
| The app (this repo: frontend + Express API together) | app.governmentaffairs.io | **Render** web service `gov-affairs-app` |

- **Domain migration .co → .io is COMPLETE (2026-09-24).** `governmentaffairs.co`
  and `www.governmentaffairs.co` sit on the same Vercel project as permanent
  (308) redirects to their `.io` equivalents. `app.governmentaffairs.co` still
  resolves to Render too, but all code, email (Resend sender
  `no-reply@governmentaffairs.io`) and links target `.io`. LinkedIn OAuth's
  redirect_uri is built from the live request host, not hardcoded.
- **One landing project only.** V0 publishes to Vercel project
  `government-affairs` (id `prj_i5KERafBo3fOwHs3bxOmXcRVNd7K`, preview URL
  govaffairs.vercel.app), and the real domains live on that same project, so
  V0 "Publish" goes straight to production. The duplicate `v0-project` was
  deleted 2026-09-24 after a V0 edit landed there instead of on the live
  domain — if landing edits "don't show up", first check which project V0
  published to vs. which project holds `governmentaffairs.io`.
- Moving a domain between Vercel projects fails with 409 while another domain
  on the source project redirects to it: move the redirecting domains first,
  then re-set the redirect (`vercel api /v9/projects/<p>/domains/<d> -X PATCH
  -f redirect=<target> -F redirectStatusCode=308`). Domain changes are blocked
  for Claude by the auto-mode classifier — hand Andrew the commands. When
  giving `www.` commands, use `W=www; … $W.governmentaffairs.io` — the chat
  UI turns bare `www.` addresses into markdown links on copy.
- **The old Hostinger VPS (187.77.217.123) and the old Vercel app project are
  RETIRED/DELETED.** Do not reference them.
- Render auto-deploys on push to `main` (~3 min). Blueprint: `render.yaml`.
  Deploy guide: `RENDER_DEPLOY.md`.
- DNS is at GoDaddy. `app` CNAME → `gov-affairs-app.onrender.com` (both the
  `.io` and `.co` zones).
- Landing-page changes happen in V0 (chat), not this repo. Its "Log in" buttons
  point at app.governmentaffairs.io/login; "Book a demo" →
  calendly.com/smartloads/gov-affairs-demo. The homepage video section was
  removed (it was an empty placeholder); plan is a click-to-open modal from
  "See how it works" + a shareable /demo page once the demo video exists.

## Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind + shadcn (client/)
- Backend: Express (server/), bundled to dist/index.mjs by script/build.ts;
  `npm start` runs dist/index.cjs. One service serves API + built frontend.
- DB: Supabase Postgres `wogcfejomgyjgbaosdyg`, Drizzle ORM (shared/schema.ts)
- **DATABASE_URL must be the Session-pooler URL**
  (`postgres.wogcfejomgyjgbaosdyg@aws-0-us-west-2.pooler.supabase.com:5432`).
  The direct `db.<ref>.supabase.co` host is IPv6-only and UNREACHABLE from
  Render (ENETUNREACH).
- Auth: email/password (bcrypt) + Postgres-backed sessions (`app_sessions`).
  Replit OIDC is dead code. Sessions require `SESSION_SECRET`.

## AI Providers (server/services/ai-providers.ts is the single source of truth)
- **Anthropic is primary** (`AI_INTEGRATIONS_ANTHROPIC_API_KEY`), model
  constant `claude-sonnet-4-6` — powers Morning Brief ranking, Decision
  Briefs, and chat.
- **Perplexity `sonar`** (`PERPLEXITY_API_KEY`) — web-grounded research paths.
- **Parallel.ai** (`PARALLEL_API_KEY`) — Decision Brief source extract/search
  (~$85 credit as of Aug 2026).
- OpenAI/Gemini optional fallbacks. **Never set `*_BASE_URL` vars to the old
  Replit `localhost:1106/modelfarm` sidecar** — leave BASE_URLs unset.
- Startup preflight logs provider status: grep Render logs for
  `[ai-providers]`. `NOT CONFIGURED` lines name missing keys exactly.
- Chat provider order: anthropic → openai → gemini (routes.ts /api/research/chat).

## Feature State (post Aug-11 marathon, PRs #1–#14)
Working end-to-end:
- **Morning Brief** (`/morning-brief`, dashboard hero): ranks last-48h news +
  gov press releases per client profile via one compact Claude call
  (index-based output, ≤15 items, max_tokens 2000 — do NOT revert to
  UUID-echo format; long outputs die at Render's ~100s proxy timeout and the
  UI skeleton spins forever). Requires a `client_profiles` row per firm.
  Time-aware header (Morning/Afternoon/Evening Brief).
- **Grounded AI chat** (global sheet): tool-use loop in
  server/services/grounded-chat.ts with `search_staff_directory` against
  `legistorm_staffers` (16.7k current staffers, emails for ~94%). Staffer
  cards show Email (mailto) + LinkedIn-search actions. linkedin_url column is
  0% populated — don't promise stored profiles. Inline name-links were
  removed (dead /network?search routes — /network ignores the param).
- **Decision Briefs** (/briefs): paste URLs → Parallel extract → Claude brief
  → magic-link public share. Exercised and working.
- **"Should I be worried?"** (ask box on dashboard + /briefs; "Should I be
  worried?" button on Morning Brief items): `POST /api/briefs/ask` →
  `server/services/ask-service.ts` plans (one small Claude call) → Congress.gov
  bill data + stored `government_press_releases` + Parallel **v1** web search
  (`webSearch()`; the older v1beta search/extract calls still serve the brief
  pipeline) → ≤6 sources saved with pre-filled content/excerpts →
  `generateBrief()`. Sources that already carry `extracted_content` skip
  Extract. Every brief now has an optional `bottomLine {level: low|watch|act,
  answer}` (calm, calibrated). Capped at 40 briefs/firm/24h. A brief with no
  sources re-runs discovery on "Try again"; a "generating" run older than
  5 min is treated as dead (deploy restarts). Grep Render logs for `[ask]`.
  Not yet covered: state bills (would spend LegiScan queries).
- **Prediction markets** (dashboard + /predictions): Kalshi elections API.
  `ensureMarketsCache()` = ONE nested-events crawl (with_nested_markets=true,
  ~8 requests / 5-min cache) serving ALL category tabs; activity-sorted
  (volume_24h*3 + volume + open_interest). Do NOT reintroduce per-event
  crawls (429 storms) or exact-match UI categories (see CATEGORY_ALIASES:
  "Tech"→"Science and Technology", "Culture"→"Entertainment"+"Social").
- **Email** via `RESEND_API_KEY` (+ optional `RESEND_FROM_EMAIL`, default
  no-reply@governmentaffairs.io). Password reset works. The old Replit
  connector email path is deleted.
- **State bill tracking (LegiScan)**: Bills page has a Federal / State toggle.
  State bills live in `tracked_bills` with `jurisdiction` = state code,
  `congress = 0`, `billType = "state"`, `billNumber = legiscan bill_id`; label/
  URL helpers in `shared/bill-label.ts`. Client: `server/services/legiscan-api.ts`
  — every call counted in `legiscan_usage`, refused past
  `LEGISCAN_MONTHLY_BUDGET` (default 9,000; free tier is 10,000/mo). Alerts
  (bill-alert-service, every 6h) do one `getMasterListRaw` per tracked
  session and `getBill` only for bills whose `change_hash` moved. Honor the
  LegiScan survey declarations (see memory `legiscan-api-terms`): CC BY 4.0
  attribution wherever the data shows (`LEGISCAN_ATTRIBUTION`), serve users
  from our DB, calls only from Render. Don't call LegiScan from a laptop.
- **Security (PR #7)**: morning-brief IDOR fixed (client-scope check);
  first-login super-admin auto-promotion removed; demo seeder gated out of
  production. Note: ~300 routes exist; only ~170 call getClientId — a full
  authz audit is still open backlog.

## Known Issues / Backlog (prioritized)
1. ~~**Phase 1 flagship**: "Should I be worried?" box~~ — shipped (see
   Feature State). Next: state-bill discovery, and tune source mix from
   real usage (`[ask]` log lines show counts per source kind).
2. **Path Builder** (marketing hero promises it): co-tenure graph from
   `legistorm_staffers.positions` JSONB (person/office/date tuples) + BFS
   from known contacts to target office; `findSchedulerForMember()` in
   legistorm-service.ts exists unused ("who books the meeting").
3. **Staleness**: `syncRetiredStaffers()` has ZERO callers; incremental
   LegiStorm sync is manual-only. Wire both into index.ts schedulers.
4. Chat: add `search_bills` (Congress.gov) as second tool; possibly
   press-release search.
5. `client_profiles` is per-FIRM not per-end-client — schema change needed
   before per-client briefs.
6. ~~Bill tracking never alerts~~ — fixed (PR #20: bill-alert-service emails
   `ALERT_EMAIL` every 6h). Alerts still go to one address, not per-firm users.
7. File uploads dead (Replit object storage; route registration commented out).
8. Off-thesis modules dilute demos: sports, marketing intel, influencers,
   social, rank tracking, local-gov, Miro. Candidates to feature-flag/hide.
9. Orphan pages not in sidebar: /ai-agent, /staffer-intelligence.
10. tsc has ~296 pre-existing errors in legacy pages (network.tsx,
    staffers.tsx…). Don't try to fix wholesale; keep new files clean.

## Working Agreements
- Branch + PR for everything. **Claude may merge its own PRs** (Andrew,
  2026-09-24; `main` protection = PR required, 0 approvals): wait for the
  CodeRabbit check to finish and address real findings, build/tsc clean,
  then `gh pr merge <n> --merge`, then verify the Render deploy live. Ask
  Andrew first for risky merges: DB schema/SQL, auth/sessions, billing,
  env-var dependencies, or anything destructive. **Never push to a branch
  after its PR merges** — new branch + new PR (bitten twice).
- Render deploys main automatically; verify via Render Logs (search
  `[ai-providers]`, `[morning-brief]`, `[Kalshi]`, `[grounded-chat]`).
- SQL: Supabase Dashboard SQL Editor (paste blocks in chat for Andrew), or
  read-only via Management API:
  `curl -X POST https://api.supabase.com/v1/projects/wogcfejomgyjgbaosdyg/database/query
   -H "Authorization: Bearer $(cat ~/.supabase/access-token)" -d '{"query":"…"}'`
- Multiple Supabase projects exist in the account (trucking, propthis) —
  always confirm the project ref before running SQL.
- Andrew is non-technical-founder-technical: explain in plain terms, give
  copy-pasteable steps, flag secrets hygiene (rotate anything pasted in chat).
- Local dev: `npm run dev` (port 5000). `.env.local` mirrors Render env.
  Never point local dev at prod with service-role keys.

## Brand System (full guide: docs/BRAND.md; original vendored at docs/brand-guide.html)
Capitol Navy `#14253D` (authority, GA mark), Signal Blue `#078ACB` (actions),
Paper `#F7F6F2` (marketing surfaces), Stone `#E9ECEC`, Civic Red `#A53B39`
(editorial accent; also the "Act now" concern level). Font: Source Sans 3
(headlines 650 weight, −4% tracking). App shell is **"Fresh"** (Sep 2026,
Andrew's call): light mode = white sidebar + near-white canvas; dark mode
keeps the navy shell. GA mark = **"Dome"** (round G + Capitol-arch A) —
use `<GaMark />` (client/src/components/ga-mark.tsx; auto-inverts in dark
mode); favicon.svg/png + government-affairs-logo.svg match it. The V0 landing
page still has the old typeset GA mark until it's updated there.
**Site-wide redesign (Sep 2026):** Source Sans 3 is the only font (index.html
loads just it + JetBrains Mono); every page uses `PageShell` + `PageHeader`
(client/src/components/page-header.tsx); navigation = icon rail with
floating menus (client/src/components/app-nav.tsx — groups Home | News,
Press, Markets | Bills, Hearings | People, Strategy, Research | Clients |
Knowledge, Settings at the bottom; add new pages to CLIENT_GROUPS). Pages use
near-full width — Andrew dislikes empty side margins. Rules in docs/BRAND.md
"Interface language" — follow them for any new page.
Voice: "find, connect, map, monitor, brief, reach" — no AI hype.
Signature line: "Find the path to the people who shape policy."

## API Integrations (all keys in Render env)
Congress.gov v3 (bills/members — most load-bearing), LegiScan (state bills,
`LEGISCAN_API_KEY`), LegiStorm v2 (staff
directory), Perplexity, Parallel.ai, Firecrawl, PDL, Kalshi (RSA-signed),
SearchAPI, Influencers.club, Miro (optional), Resend.

## Env Var Pitfalls
- GOV_PRESS_USER_AGENT contains parentheses → breaks `source .env` shell
  expansion. Use `node --env-file=.env` for scripts; never inline-source.
- Single-quote multi-word .env values.
- Don't run diagnostic SQL via `npx tsx -e` (leaks connections, hangs) — use
  the Dashboard or Management API.

## Migration History (compressed)
Replit (early 2026, suspended) → Vercel-static + dead VPS backend (April) →
**Aug 11 2026: full resurrection** — backend to Render, domains split
(landing vs app), login/interior rebranded to brand system, Anthropic/Parallel
keys wired, security P0s fixed, Morning Brief + grounded chat + live Kalshi
shipped (PRs #1–#14). V0 owns the landing page.
