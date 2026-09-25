# GovernmentAffairs.io Brand System

Distilled from the official brand guide. The full slide-format guide is
vendored at [docs/brand-guide.html](brand-guide.html); the live copy is at
https://www.governmentaffairs.io/brand-guide.html. If they ever disagree,
the live guide wins — re-vendor it here.

## Core message

> **Find the path to the people who shape policy.**

- **Purpose:** make complex political and relationship data useful at the
  moment a team needs to reach a decision-maker.
- **Promise:** reveal who matters, who can connect you, and where the next
  conversation can happen.
- **Personality:** informed, direct, discreet, institutional, practical,
  confident — never flashy or speculative.

## Color system

| Name | Hex | Role |
|---|---|---|
| Capitol Navy | `#14253D` | Primary / authority (headings, GA mark, dark-mode sidebar) |
| Signal Blue | `#078ACB` | Actions and pathways (buttons, links, active nav tint) |
| Paper | `#F7F6F2` | Editorial/marketing reading surfaces |
| Stone | `#E9ECEC` | Secondary surfaces, borders |
| Civic Red | `#A53B39` | Reserved editorial accent — never primary CTAs |

## Typography

**Source Sans 3** is the primary and only brand typeface (weights 400, 500,
650, 700, 800).

- **Headlines:** 650 weight, −4% letter spacing, sentence case.
- **Subheads:** 700 weight, short useful labels.
- **Body:** 400–500, 16px minimum, 1.5–1.7 line height.
- **Eyebrow/kicker:** 800 weight, uppercase, tracked (≈0.18em).
- Email exception: clients don't load webfonts — use the system sans stack,
  keep the weight/tracking hierarchy.

## Logo system

- **Lockup:** GA mark + "GovernmentAffairs.io" wordmark, Source Sans 3
  ExtraBold/800. The ".co" renders in Signal Blue.
- **GA mark ("Dome", Sep 2026):** a navy rounded tile (corner radius 22%)
  holding a round geometric G and an arched A whose top echoes the Capitol
  dome, drawn as uniform white strokes. On dark backgrounds it inverts: white
  tile, navy glyph. Source of truth: `client/src/components/ga-mark.tsx`
  (`<GaMark />` flips automatically in dark mode) and
  `client/public/favicon.svg`. The earlier typeset "GA" square is retired.
- **Clear space:** at least half the GA mark's width on every side.
- **Minimum size:** full lockup 180px digital; mark alone 28px (favicons are
  the accepted exception).
- **Never:** stretch, recolor individual letters, add effects, or place over
  busy imagery.

## Interface language

- **App shell ("Fresh", Sep 2026):** light mode uses a near-white canvas,
  a white sidebar with navy text, and a pale Signal Blue tint for the active
  item; cards are white with hairline borders. Dark mode keeps the navy
  shell. Tokens live in `client/src/index.css`.
- **Page anatomy:** every page uses `<PageShell>` + `<PageHeader>`
  (`client/src/components/page-header.tsx`): Signal Blue eyebrow naming the
  sidebar section (Monitor / Brief / Reach / Clients / Workspace), a
  650–700 weight title, one plain sentence of description, actions on the
  right. No decorative icons beside page titles, no serif, no gradient text.
- **Navigation (Sep 2026, v4):** top bar = News · Press · Markets links,
  search, a "Should I be worried?" button (opens the ask box over any page),
  Research assistant. Icon rail = Today · Briefs | Bills, Hearings | People,
  Strategy, Research | Clients | Knowledge, with Settings and the account
  menu at the bottom; Bills, People and Settings open floating menus. The
  phone menu lists everything, including the top-bar feeds.
  Source: `client/src/components/app-nav.tsx`, `top-bar-links.tsx`.
- **Today (`/dashboard`)** is the home page: the Morning Brief is the page
  body, with a right rail of At a glance, Recent briefs and Prediction
  markets (`components/today/today-rail.tsx`). `/morning-brief` redirects.
- **Use the room:** pages run wide with side padding that grows with the screen (`PageShell`: 40–80px sides, 1600px cap);
  split wide content into columns (Morning Brief: priorities | watch list;
  brief page: brief | sources) rather than centering a narrow column.
  `width="narrow"` is only for forms.
- **Color discipline:** red/destructive only for errors and destructive
  actions. Relevance scores and "new update" notices use the Signal Blue
  tint (`bg-primary/10 text-primary`), never alarm red. Concern levels are
  the one exception: Low (emerald) / Worth watching (amber) / Act now
  (Civic Red).
- **Empty states:** centered muted circle icon, short bold title, one line
  of explanation, optional primary action.
- **Voice in UI:** no "AI-powered"/"AI Chat" labels — name the outcome
  ("Research assistant", "Discover connections").
- **Radius:** 3–6px — avoid soft, inflated card shapes.
- **Spacing:** 8px base rhythm, generous section spacing.
- **Icons:** simple outlined icons at 16, 20, or 24px.
- **Buttons:** primary = Capitol Navy; pathway/action = Signal Blue;
  secondary = navy outline. Primary CTA is "Book a demo".
- Prioritize hierarchy, useful contrast, and fast scanning over novelty.

## Photography & imagery

- **Use:** authentic briefings, staff collaboration, government architecture,
  events, relationship-building moments. Natural editorial treatment,
  restrained color, documentary lighting.
- **Avoid:** abstract AI imagery, glowing orbs, fake dashboards, staged
  handshakes, flags as decoration, partisan symbolism.
- The 9-image "connection scenario" library (reception, roundtable, corridor,
  hotel lobby, casual bar, coffee, capitol office, conference hallway,
  baseball) downloads from the live guide; the login page uses five of them
  from `client/public/login/`.

## Voice & messaging

- Lead with practical outcomes; use confident verbs: **find, connect, map,
  monitor, brief, reach**.
- No vague AI claims, political hype, fear-based urgency, or unprovable
  superlatives ("revolutionary", "game-changing").
- Message hierarchy: **headline** = the human outcome → **support** = how
  aggregated data makes it possible → **CTA** = the next concrete step.

## Asset locations

- In this repo: `client/public/favicon.svg` + `favicon.png` (GA mark),
  `client/public/government-affairs-logo.svg` (lockup),
  `client/public/login/*.jpg` (sign-in imagery).
- On the live site (V0 project): `/government-affairs-logo.png|.svg`,
  `/government-affairs-mark.svg`, `/icon.svg`, `/icon-light-32x32.png`,
  `/apple-icon.png`, `/connection-image-*.png`, `/capitol-hero-backdrop.png`.
- Branded email layout: `renderBrandedEmail()` in
  `server/services/email-service.ts` — use it for all outgoing email.
