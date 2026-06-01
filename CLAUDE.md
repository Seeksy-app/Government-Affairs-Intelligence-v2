# Government Affairs Intelligence — Engineering Reference

## Business Model
Government affairs / legislative intelligence platform. Monitors 
Congress, regulatory activity, political trading signals for 
clients needing DC intel.

## Domain
- governmentaffairs.co (Vercel)

## Stack
- Frontend: React (client/ folder), Vite, TypeScript, Tailwind
- Backend: Express server (server/ folder) — runs on VPS
- Database: Supabase (wogcfejomgyjgbaosdyg)
- ORM: Drizzle (see drizzle.config.ts)
- Deployed from: originally Replit → migrated to Cursor + 
  Vercel + Supabase

## Folder Structure
- attached_assets/ — static assets
- client/ — React frontend
- server/ — Express backend
- shared/ — code shared between client and server
- script/ — utility/migration scripts
- replit.md — legacy Replit config notes (migration reference)

## Infrastructure
- Supabase Project ID: wogcfejomgyjgbaosdyg
- GitHub: Seeksy-app/Government-Affairs-Intelligence-v2
- Local: ~/government-affairs
- Frontend: Vercel at governmentaffairs.co
- Backend: Express on VPS 187.77.217.123

## API Integrations
- LegisStorm — legislative + staff intelligence
- Firecrawl — web scraping
- Congress.gov — official congressional data
- PDL (People Data Labs) — person/company enrichment
- Kalshi — political prediction markets
- Perplexity — AI search
- Miro — visualization/collaboration
- SearchAPI — search aggregation

## Known Issues
- CRITICAL: Clicking governmentaffairs.co URL triggers a file 
  download instead of loading the page. Likely causes:
  1. Vercel serving wrong Content-Type headers
  2. Missing/misconfigured vercel.json routing
  3. Build output missing index.html
  4. Express backend catching frontend routes
  - Check: vercel.json, client build output, server routes 
    priority
- No active user/client yet — platform not in active use

## Migration History
- 2026-01 to 2026-03: Lived on Replit (suspended)
- 2026-03-16: First GitHub commit (government-affairs-intelligence)
- 2026-03-24: v2 repo created (current active repo)
- 2026-04: Migrated deploy to Vercel + Supabase

## Backlog
- Fix URL-triggers-download bug (blocker for any use)
- Verify Express backend still runs on VPS
- Verify Supabase schema migrated from Replit correctly
- Establish primary user/client

## Commands
- Dev: npm run dev (check package.json scripts)
- Build: npm run build
- SQL always in Supabase Dashboard

## Known Env Var Pitfall
GOV_PRESS_USER_AGENT contains parentheses:
  NewsBlur Feed Fetcher - 1 subscriber (http://www.newsblur.com/)
This breaks shell variable expansion in inline -e scripts (source .env hangs
or errors). For DB queries: use Supabase Dashboard SQL, not inline tsx via
xargs/env-substitution. For script files: use
  node --env-file=.env --import tsx/esm script/name.ts
which loads .env natively without shell interpolation.

## Lessons logged from June 1 session

- env var values with parens break shell parsing in `source .env`. Always single-quote multi-word .env values.
- `npx tsx -e` and `node --eval` patterns leak Postgres connections and hang CC. Use Supabase Dashboard SQL Editor for diagnostic queries instead.
- 5-minute spinner = hang signal. Don't wait 30 minutes hoping it recovers. Esc, diagnose, retry.
- Long nano pastes truncate silently. For >50 line files, use bash heredoc or download-from-Claude-and-move method.
- Federal Register is already in News Intelligence. Don't re-ingest as a press release source.
- NewsBlur Feed Fetcher User-Agent bypasses Akamai (DOL). Does NOT bypass Cloudflare JS challenge (EPA needs headless browser).
