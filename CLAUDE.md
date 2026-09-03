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

## Domains & Hosting (current as of 2026-09-03 — mid domain migration .co → .io)
| Surface | URL | Host |
|---|---|---|
| Marketing landing (V0-built, separate codebase) | governmentaffairs.io | Vercel project `v0-project` |
| The app (this repo: frontend + Express API together) | app.governmentaffairs.io *(pending DNS — see below)* | **Render** web service `gov-affairs-app` |

- **Domain migration in progress (started 2026-09-03):** the company domain
  moved from `governmentaffairs.co` to `governmentaffairs.io`. Resend and the
  Vercel landing project (`v0-project`, formerly `govaffairs`) are already on
  `.io`. **`app.governmentaffairs.io` has no DNS yet** — Render's app is still
  only reachable at `app.governmentaffairs.co` until someone adds an `app`
  CNAME for `governmentaffairs.io` at GoDaddy (same playbook as the original
  setup — see `RENDER_DEPLOY.md`) and attaches the custom domain in Render.
  All code (email sender/footer, in-app links, LinkedIn OAuth callback — which
  is built from the live request host, not hardcoded) already targets `.io`.
  The old `govaffairs` Vercel project survives, renamed to
  `govaffairs-old-landing`, as an instant rollback if needed.
- **The old Hostinger VPS (187.77.217.123) and the old Vercel app project are
  RETIRED/DELETED.** Do not reference them.
- Render auto-deploys on push to `main` (~3 min). Blueprint: `render.yaml`.
  Deploy guide: `RENDER_DEPLOY.md`.
- DNS is at GoDaddy. `app` CNAME → `gov-affairs-app.onrender.com` (still only
  set up for the `.co` zone — see migration note above).
- Landing-page changes happen in V0 (chat), not this repo. Its "Log in" buttons
  point at app.governmentaffairs.io; login page "Book a demo" →
  calendly.com/smartloads/gov-affairs-demo.

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
- **Prediction markets** (dashboard + /predictions): Kalshi elections API.
  `ensureMarketsCache()` = ONE nested-events crawl (with_nested_markets=true,
  ~8 requests / 5-min cache) serving ALL category tabs; activity-sorted
  (volume_24h*3 + volume + open_interest). Do NOT reintroduce per-event
  crawls (429 storms) or exact-match UI categories (see CATEGORY_ALIASES:
  "Tech"→"Science and Technology", "Culture"→"Entertainment"+"Social").
- **Email** via `RESEND_API_KEY` (+ optional `RESEND_FROM_EMAIL`, default
  no-reply@governmentaffairs.io). Password reset works. The old Replit
  connector email path is deleted.
- **Security (PR #7)**: morning-brief IDOR fixed (client-scope check);
  first-login super-admin auto-promotion removed; demo seeder gated out of
  production. Note: ~300 routes exist; only ~170 call getClientId — a full
  authz audit is still open backlog.

## Known Issues / Backlog (prioritized)
1. **Phase 1 flagship**: "Should I be worried?" box — free-text question/bill#/
   headline → auto source discovery (Parallel search + Congress.gov +
   gov press) → existing brief-service pipeline → cited answer. The output
   schema in brief-service.ts is already right; only retrieval is missing.
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
6. Bill tracking never alerts (alerts written, never read/sent).
7. File uploads dead (Replit object storage; route registration commented out).
8. Off-thesis modules dilute demos: sports, marketing intel, influencers,
   social, rank tracking, local-gov, Miro. Candidates to feature-flag/hide.
9. Orphan pages not in sidebar: /ai-agent, /staffer-intelligence.
10. tsc has ~296 pre-existing errors in legacy pages (network.tsx,
    staffers.tsx…). Don't try to fix wholesale; keep new files clean.

## Working Agreements
- Branch + PR for everything; Andrew merges. **Never push to a branch after
  its PR merges** — new branch + new PR (bitten twice).
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
Capitol Navy `#14253D` (authority/sidebar), Signal Blue `#078ACB` (actions),
Paper `#F7F6F2` (surfaces), Stone `#E9ECEC`, Civic Red `#A53B39` (editorial
accent only). Font: Source Sans 3 (headlines 650 weight, −4% tracking).
GA mark: navy square + white "GA" (inverted to white square + navy GA on dark
backgrounds). Voice: "find, connect, map, monitor, brief, reach" — no AI hype.
Signature line: "Find the path to the people who shape policy."

## API Integrations (all keys in Render env)
Congress.gov v3 (bills/members — most load-bearing), LegiStorm v2 (staff
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
