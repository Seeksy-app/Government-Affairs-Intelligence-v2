# Deploying the app on Render (plain-English guide)

**Goal:** get the app's "brain" (the Express backend) running again on an
always-on host, and point **`app.governmentaffairs.co`** at it. The V0 landing
page stays on Vercel at **`governmentaffairs.co`** — untouched.

**Why Render and not Vercel:** this backend runs continuously and does scheduled
background work (news pulls, LegiStorm + House directory syncs). Vercel only runs
code in short bursts, so it can't host this app without a risky rewrite. Render
runs it exactly as it was built on the old VPS.

**Verified:** `npm run build` produces `dist/index.mjs` (server) + `dist/public`
(frontend). `npm start` runs the server. `render.yaml` wires this up for Render.

---

## Part A — Deploy on Render (you)

1. Go to **render.com** and sign up (GitHub login is easiest).
2. **New ▸ Blueprint.**
3. Connect the GitHub repo **`Seeksy-app/Government-Affairs-Intelligence-v2`**.
   Render reads `render.yaml` automatically and sets up the service.
4. It will ask you to fill in the secret values (the `sync: false` keys). Get
   these from your **existing Vercel project** (Settings ▸ Environment Variables)
   or your local **`.env.local`** file. Render has a bulk **"Add from .env"**
   paste box — quickest way. See the checklist below.
5. **Two values need attention:**
   - **`APP_URL`** → set to **`https://app.governmentaffairs.co`** (this is new —
     it makes password-reset email links point at the right place).
   - **`DATABASE_URL`** → reuse your existing one (it already points at Supabase).
6. Click **Create / Deploy**. First build takes a few minutes. Watch the log —
   it should end with `serving on port ...`.

## Part B — Point the domain (you)

1. In Render, open the service ▸ **Settings ▸ Custom Domains ▸ Add**
   `app.governmentaffairs.co`. Render shows you a **CNAME target** (like
   `gov-affairs-app.onrender.com`).
2. Go to wherever you manage DNS for `governmentaffairs.co` (likely **Vercel**,
   since the landing page lives there). Find the existing **`app`** record — it
   currently points at Vercel — and **change it to the Render CNAME** from step 1.
3. Wait for it to go green in Render (a few minutes to an hour). Render adds the
   HTTPS certificate automatically.

## Part C — Verify (me)

Once it's live, tell me and I'll check end-to-end that:
- `app.governmentaffairs.co` loads the real app (not just the shell),
- login actually works (real response, not the webpage),
- data loads.

I'll fix any leftover code that still references the old address.

---

## Env var checklist

Reuse existing values from Vercel / `.env.local` unless noted.

**Required to boot**
- `DATABASE_URL` — reuse (points at Supabase `wogcfejomgyjgbaosdyg`)
- `SESSION_SECRET` — reuse
- `APP_URL` — **set to `https://app.governmentaffairs.co`**
- `NODE_VERSION` — already set to `20` in `render.yaml`

**Email**
- `RESEND_API_KEY` — needed for password-reset emails. If it isn't in Vercel,
  it's on the old VPS `.env`, or generate a new one in Resend.

**Data / intelligence APIs** (reuse)
- `CONGRESS_API_KEY`, `LEGISTORM_API_KEY`, `FIRECRAWL_API_KEY`,
  `PERPLEXITY_API_KEY`, `PDL_API_KEY`, `KALSHI_API_KEY`, `SEARCHAPI_API_KEY`,
  `INFLUENCERS_API_KEY`

**AI providers** (reuse)
- `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`,
  `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`

**File uploads / object storage** (reuse if present)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`,
  `PUBLIC_OBJECT_SEARCH_PATHS`

**Optional** (only if used)
- `MIRO_API_KEY`, `MIRO_CLIENT_SECRET`, and any others from your old `.env`.

---

## Known follow-ups (not blockers for launch)

- **File uploads / object storage** used Replit/Google Cloud Storage. On Render
  that may need a Google Cloud credentials env var to work. Login and the core
  app do **not** depend on it — we can sort uploads after the app is back up.
- **Memory tier:** if the app crashes during the large LegiStorm / House
  directory sync, raise the Render plan from `starter` to `standard` (one click).
- **Old Vercel "app" project:** once `app.` points at Render and works, the
  Vercel static "app" project is no longer used and can be deleted. (Leave the
  **landing page** Vercel project alone.)
- **Login cookies:** login is email/password with sessions stored in Postgres.
  Because the app and its API are the same address (`app.governmentaffairs.co`),
  cookies work with no extra config.
