# Vercel deployment notes — governmentaffairs.co download bug

## 1. Findings: `server/index.ts`

### Does production serve static files from `dist/public/`?

**Yes, indirectly.** In production (`NODE_ENV === "production"`), the app calls `serveStatic(app)` from `server/static.ts`. That module resolves the static root as `path.resolve(__dirname, "public")` relative to the **compiled server bundle** in `dist/`, which resolves to **`dist/public/`** after `npm run build`. It uses `express.static` for that directory, then a catch-all that sends `index.html` for unmatched paths.

In development, the same ordering applies except the client is served via `setupVite()` instead of `serveStatic()`.

### Route ordering (static vs API)

1. Global middleware: `express.json`, `express.urlencoded`, request logging.
2. **`registerRoutes(httpServer, app)`** — all API and app routes (including auth) are registered **first**.
3. Startup side effects: `seedDatabase()`, platform module initialization (inside the same async IIFE).
4. Express error-handling middleware (`res.json` errors).
5. **Last:** either `serveStatic(app)` (production) or `await setupVite(...)` (development).

So **API and registered routes take precedence** over the static file server and SPA fallback, matching the comment in `index.ts` that Vite must be set up after other routes so the catch-all does not interfere.

### Production-only branches

- **`process.env.NODE_ENV === "production"`** → `serveStatic(app)` (built assets from `dist/public`).
- **Else** → dynamic Vite dev middleware via `setupVite()`.

There is no other production-only static path in `index.ts`; the split is entirely static vs Vite for the frontend.

---

## 2. `package.json` scripts (confirmed)

| Script   | Command |
| -------- | ------- |
| `dev`    | `NODE_ENV=development tsx server/index.ts` |
| `build`  | `tsx script/build.ts` |
| `start`  | `NODE_ENV=production node dist/index.cjs` |

The production server entry is **`dist/index.cjs`** (not edited per task constraints).

---

## 3. Local `npm run build` output (`dist/`)

After a successful build (not committed; `dist/` is gitignored):

**`dist/`**

- `index.mjs` — large server ESM bundle (~1.8 MB in this run).
- `index.cjs` — small CommonJS entry used by `npm start` (wrapper/shim).
- `public/` — Vite client output directory.

**`dist/public/`**

- `index.html`
- `favicon.png`, `demo.mp4`
- `assets/` — hashed JS/CSS (and any other emitted client assets).

This matches the mental model: **Vercel should treat `dist/public` as the deployable static site root**, not the repo root or `dist/` as a whole (serving `index.mjs` as a page would cause wrong `Content-Type` behavior and the classic “browser downloads a file” symptom).

---

## 4. Deployment model chosen

**Static-only frontend on Vercel** — configured in root **`vercel.json`**:

- **Build:** `npm run build` (full monorepo build; Vite still writes client files to `dist/public`).
- **Output directory:** `dist/public` (only HTML/JS/CSS/assets are published to the CDN).
- **SPA rewrite:** all paths → `/index.html` so **wouter** client routes work on refresh and deep links.

**Why this is the safest first step**

- No `vercel.json` previously meant Vercel likely treated the project as a generic Node app or mis-detected outputs, so the **default document might not be `index.html`**, or the wrong file (e.g. a bundle) could be served with a disposition or type that triggers a download.
- Deploying **only** `dist/public` aligns with how the Express app serves the UI in production and avoids running Express on Vercel in this pass (per CLAUDE.md, the API stays on the VPS).

**Express is not deployed as a Vercel serverless function** in this configuration.

---

## 5. What this means operationally

- **Marketing / SPA shell** should load on `governmentaffairs.co` once the project uses the new static output settings.
- **Any `fetch`/`apiRequest` to relative `/api/...` (or same-origin API)** from the Vercel domain **will not hit the VPS Express app** unless you add a separate integration (rewrites to an external backend, serverless proxies, or a configured API base URL). Expect **CORS** and **wrong base URL** issues until the client is pointed at the real API host (e.g. `https://<vps-or-api-domain>`) and the backend allows the Vercel origin.
- **Database / `DATABASE_URL` on Vercel** only matters if something on Vercel connects to Postgres (e.g. future serverless or edge). For **pure static** hosting, the browser never uses `DATABASE_URL`; the **VPS** and local dev do. Still, keeping Vercel env vars consistent avoids confusion when you add server-side pieces later.

---

## 6. Open questions for Andrew

1. **Canonical public API base URL** — What hostname (and path prefix) should the production SPA use for `/api`? (e.g. `https://api.governmentaffairs.co` vs `http://187.77.217.123:PORT`.) That decision drives CORS, cookies, and HTTPS mixed-content rules.
2. **Session/auth cookies** — If the app uses cookie-based sessions against Express, confirm **SameSite**, **Secure**, and **domain** attributes when the UI is on Vercel and the API is elsewhere; you may need a dedicated API subdomain and explicit cookie domain.
3. **Whether Vercel should run `npm run build` or a slimmer client-only build** — Today `npm run build` runs the full `script/build.ts` (client + server). For static-only Vercel, that is correct for producing `dist/public`; if build time or secrets in the server bundle ever become an issue, a **client-only** build script would be a follow-up (not implemented here per constraints).
4. **SPA rewrite vs. static files** — Vercel applies filesystem matches before rewrites for typical static deployments; if anything odd happens with `/assets/*`, we can narrow the rewrite pattern (document only — no code change in this task).

---

## 7. Vercel Dashboard checklist (manual)

- **Environment variable — `DATABASE_URL`:** Update to the new pooler URL when you want Vercel-side or CI access aligned with Supabase’s pooler:

  `postgresql://postgres.wogcfejomgyjgbaosdyg:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres`

  (Replace `[PASSWORD]` with the real secret; do not commit it.)

- **Framework preset:** Set to **Other** or **Vite** as you prefer; **`vercel.json` overrides build/output** when those keys are present, but a wrong preset can still affect detection noise in the UI.
- **Build & output settings:** Confirm they match **`vercel.json`**: build command `npm run build`, output directory **`dist/public`**.
- **Redeploy** after merging or uploading `vercel.json`, then verify `https://governmentaffairs.co/` returns **HTML** (`text/html`) and does not attach **`Content-Disposition: attachment`**.

---

## 8. Codebase changes deferred (document only)

Per task constraints, **no** edits were made to `client/`, `server/`, `package.json`, or `script/build.ts`. If the download bug persists after static output is correct, next suspects would be: **Vercel project “Output Directory” still wrong in UI**, **cached deployment**, or **middleware at a DNS/CDN layer** — all to verify in the dashboard or DNS provider, not necessarily in this repo.
