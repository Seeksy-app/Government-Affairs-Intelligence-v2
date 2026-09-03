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
| Capitol Navy | `#14253D` | Primary / authority (sidebar, headers) |
| Signal Blue | `#078ACB` | Actions and pathways (buttons, links) |
| Paper | `#F7F6F2` | Background / reading surfaces |
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
- **GA mark:** navy square, white "GA". On dark backgrounds it inverts:
  white square, navy "GA".
- **Clear space:** at least half the GA mark's width on every side.
- **Minimum size:** full lockup 180px digital; mark alone 28px (favicons are
  the accepted exception).
- **Never:** stretch, recolor individual letters, add effects, or place over
  busy imagery.

## Interface language

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
