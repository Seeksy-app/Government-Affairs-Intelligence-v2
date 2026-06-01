# GovAffairs — Product Strategy

*Living document. Captures the why behind product decisions so they don't have to be relitigated.*

*Last updated: May 31, 2026*

---

## Founding Context

GovAffairs is a software platform for federal government affairs and lobbying professionals — people whose job is to translate political and regulatory developments into specific guidance for clients. It is owned by Business Management Company LLC and built by Andrew Appleton.

The platform launched its first material product feature — **Decision Briefs V1** — on May 30, 2026. Before that, the platform was an aggregation tool: news intelligence, staffer search across a database of ~17,000 Hill staffers (the LegiStorm dataset, since the API was deprecated), legislative tracking. Useful but undifferentiated.

Decision Briefs is the bet that turns aggregation into product. The remaining V1.x roadmap and the V2 thinking captured here is downstream of that bet.

**Repository:** `Seeksy-app/Government-Affairs-Intelligence-v2`
**Production domain (marketing site only currently):** governmentaffairs.co
**First named customer:** Adam Consulting Group (testing in early-to-mid June 2026)

---

## The Problem

A lobbyist or government affairs director spends roughly half their working week doing the same translation task: reading the news, scanning agency press releases, scanning trade press, and converting all of it into the specific guidance their clients need. *"This NDAA markup affects your defense pipeline." "This DOT rule changes your compliance posture." "This OMB memo means your grant timeline slips."*

The translation has high economic value because it is high-context, but the work itself is repetitive. Worse, it is reactive — by the time the lobbyist has finished thinking, the client has often already read the same headlines and is asking questions in the lobbyist's voicemail.

The strategic positioning of Decision Briefs is: **let the lobbyist arrive first, with the right answer, in the right format**.

The two-sentence pitch:

> You spend half your week translating headlines into "what does this actually mean for my business" — and your clients are reading the same articles and asking you the same questions before you've even thought it through. Decision Briefs turn five articles, your client's specific context, and the AI's verifiable web research into a one-page magic link you send before the call — so your client shows up with the right questions instead of the wrong assumptions.

---

## Ideal Customer Profile

### V1 ICP (today)
Solo lobbyists and small-to-mid government affairs firms (5–50 person shops). DC-based primarily, secondary in state capitals where state-level lobbying is concentrated (Sacramento, Austin, Albany, Atlanta, Tallahassee). They have 5–25 active clients each. They charge $10K–$80K/month retainers. Their bottleneck is their own time, not their relationships.

Adam Consulting Group is the prototypical V1 customer.

### V2 ICP (enterprise)
- AmLaw 200 law firms with active government relations practices
- Trade associations with federal lobbying functions (NDIA, NAM, PhRMA, USCC patterns)
- Large corporations with in-house government affairs teams in defense, healthcare, energy, tech, financial services

### Notably NOT the ICP
- Pure communications / PR firms
- Political campaign and electoral consultants
- Marketing agencies branching into "public affairs"
- General research / business intelligence platforms

The distinction matters because the V1 brief structure assumes the reader is a specific client of a specific lobbyist negotiating a specific legislative or regulatory outcome — not a marketing manager planning a campaign.

---

## The Core Product Loop

```
AGGREGATE  →  SYNTHESIZE  →  DISTRIBUTE  →  FEEDBACK
   ↑                                            ↓
   └────────────── refines profile ─────────────┘
```

1. **Aggregate.** Pull from RSS feeds (currently 15 active sources via News Intelligence), the Federal Register, and — in V1.5 — agency primary press releases (.gov sites).
2. **Synthesize.** Generate an opinionated 5-section brief grounded in client context, written by AI but curated by the lobbyist.
3. **Distribute.** Email a magic-link to the client. They land on an email-gated public view with trust-layer citations.
4. **Feedback (V2).** The client reacts, annotates, or asks questions. Signal flows back to the lobbyist, who arrives at the next meeting better prepared.

The loop is intentionally cyclical. Each pass refines the per-client context that powers the next brief.

---

## Decision Briefs: The Core Artifact

### Why a brief and not a feed, dashboard, or chatbot

A brief is an **opinionated artifact** with a definite shape. Three reasons it beats the alternatives:

1. **A feed is undifferentiated.** Every aggregator on the market produces feeds. The lobbyist's value isn't aggregation, it's synthesis.
2. **A dashboard is passive.** Dashboards display data. They don't make recommendations.
3. **A chatbot is generic.** ChatGPT can answer any question, which means it has no opinion about which question matters. The brief enforces the questions that matter for *this client* on *this issue*.

A brief commits to a structure. That commitment is the product.

### The 5-section structure (enforced, not optional)

1. **The Situation** — 2-3 sentence factual summary
2. **Why It Matters to You** — client-context specific
3. **Stakes Across Three Dimensions** — business / reputational / values
4. **Questions Worth Sitting With** — 3-5 sharp prompts
5. **Three Ways to Respond** — cautious / moderate / aggressive

Each section has a distinct cognitive purpose:
- **The Situation** establishes shared facts.
- **Why It Matters to You** demonstrates the lobbyist's understanding of the client.
- **Stakes Across Three Dimensions** prevents the lobbyist from defaulting to "business risk only" — values and reputation are equally important, and forcing all three creates better analysis.
- **Questions Worth Sitting With** moves the client from passive consumption to active decision-making.
- **Three Ways to Respond** acknowledges that there is no single right answer — but commits to three distinct paths with different risk profiles.

This structure is the IP. It is the difference between "AI wrote me a summary" and "my lobbyist wrote me a brief."

### Sensitivity modes: Internal vs Shareable

The same brief structure renders in two modes:
- **Internal** — hedged language, shows uncertainty, includes the lobbyist's strategic judgments and concerns. For the lobbyist's eyes and their team.
- **Shareable** — polished, on-message, suitable for direct client consumption.

These are not just style variants — the AI prompt template differs between modes. Internal can say "this could backfire if [X]." Shareable says "the path forward emphasizes [X]."

### Client context (V1: free-text, V2: structured profile)

V1 captures client context as a single free-text field at brief creation time. It powers the "Why It Matters to You" section and bleeds into all the others.

V2 turns this into a **Client Context Profile** — see the V2 Concepts section below.

---

## The Trust Layer

### Why it matters

LLMs produce confident-sounding text regardless of source quality. A brief built from a tabloid story and a brief built from a CBO report shouldn't look the same. They currently do, in most AI tools. That's a credibility problem masquerading as a UX problem.

If a lobbyist sends a brief and the client catches a hallucinated stat or a misattributed quote, the platform is dead. Not "needs improvement" — dead. Trust in policy work isn't recovered.

### Implementation

- **Source tier badges**, color-coded in the UI:
  - **Tier 1** (blue): Reuters, AP, WSJ, NYT, Bloomberg, .gov primary sources
  - **Tier 2** (yellow): Politico, The Hill, Defense News, Roll Call, Axios
  - **Tier 3** (grey): blogs, think tanks, less established outlets
- **Inline citations** ([1], [2]) throughout body text, linking to sources.
- **Constrained AI prompts** that require "according to [source]" language and forbid uncited claims.
- **Source footer** lists all sources with publication dates and tier badges.

### What this buys

The brief feels curated, not auto-generated. Clients can audit any claim by clicking back to the source. And — critically — this is hard for a generic LLM tool to replicate, because it requires both source curation and prompt discipline.

---

## Source Architecture

### V1 (shipped)
- 15 RSS feeds via the existing News Intelligence aggregator
- Federal Register API
- Manual URL ingest via Parallel.ai Extract API
- Search augmentation via Parallel.ai Search API
- Manual "Add Article" for one-offs

### V1.5 (planned — press release ingestion)
- .gov agency primary sources (DOL and EPA confirmed RSS; others mixed RSS/HTML scrape)
- Treated as **Tier 1 by default** (these are official sources, not interpretations)
- **Time advantage:** the lobbyist sees a DOT or Treasury announcement hours before the news coverage drops. Briefs generated at 8am from agency press releases let the lobbyist beat the news cycle.
- **Scope discipline:** build only the 5–10 agencies Adam (and future named customers) name specifically. Do not generalize to "all 16 cabinet departments" until a real customer asks for each one.

### V2 (planned)
- Per-client preferred sources, learned from lobbyist selection behavior
- Source recommendation engine (suggests sources based on brief topic + client context)
- Monitor API (lobbyist watch lists, alerts on new content matching criteria)

### Why primary sources beat news aggregation
- **Earlier in time** (the lobbyist arrives first)
- **Higher credibility** (Tier 1 trust badge)
- **Less paraphrasing distortion** (the brief reflects the actual policy, not a journalist's interpretation)
- **Directly attributable** (the client can verify)

---

## Vendor & Model Choices (Why These, Not Others)

### Parallel.ai (Search + Extract)
Chosen over Firecrawl-alone for the brief feature because Parallel provides Search AND Extract on the same platform, eliminating the composition burden of running two services in sequence. Per-brief cost is ~$0.015 ($0.005 Search + $0.005 Extract + $0.005 Claude), which produces sustainable unit economics at any pricing tier.

Future Parallel APIs (Monitor, Chat, Task) provide V2 and V3 expansion paths without re-tooling.

Risk: vendor dependency. Mitigation: the Parallel calls are isolated in `server/services/parallel-service.ts` and can be swapped behind the same interface if needed.

### Claude Sonnet 4.6 (model)
Chosen for V1 because the brief workload is well-specified, pattern-based, and benefits more from speed and cost than from raw reasoning. Opus is reserved for architecture decisions and gnarly debugging during development, not for brief generation.

`model_used` is persisted on every brief record so model choice can vary in the future (e.g., higher-tier customers get Opus output).

### Anthropic SDK (today) → AI provider abstraction (V2)
V1 calls the Anthropic SDK directly. V2 will introduce a thin AI provider interface that resolves the actual provider from a per-customer config. This sets up the BYOK (Bring Your Own Key) deployment model required by enterprise customers — see Deployment Models below.

### LegiStorm (data, not API)
LegiStorm API access died in January 2026 (401s). The 16,753 staffer records already in the database are irreplaceable and constitute a real moat: no current customer can replicate this dataset, and competitors building this from scratch would need to scrape, normalize, and continuously update.

### Supabase, Vercel, GitHub
Standard stack choices. No strategic depth — these are just what works.

---

## Deployment Models (Enterprise Strategy)

GovAffairs eventually needs to support three deployment tiers. Each unlocks a different customer segment.

### Tier 1: SaaS Hosted (today)
- Our infrastructure, our AI keys, our database.
- Customer signs up via the website, starts using the product.
- Lowest friction, lowest price point, lowest trust requirement.
- Right for: solo lobbyists, small firms, freelancers.

### Tier 2: BYOK — Bring Your Own Key (V2)
- Customer brings their own Anthropic, Azure OpenAI, or AWS Bedrock credentials.
- AI inference happens on their cloud account, billed to them, logged in their auditable infrastructure.
- Our code orchestrates; their AI executes.
- **Right for:** AmLaw 200 firms, banks, large corporates with security and compliance requirements.
- **Strategic win:** turns GovAffairs from "another AI vendor to vet" into "a workflow tool that uses the AI we already trust." Dramatically shortens security review.

### Tier 3: Customer-Hosted VPC (V3+)
- The software runs inside their cloud (AWS, Azure, GCP) entirely.
- Customer data never crosses our boundary.
- Highest trust, highest price, hardest to operate.
- Right for: Fortune 500 government affairs departments, bulge-bracket institutions, federal contractors with FedRAMP requirements.
- Mature SaaS plays here: Databricks, Snowflake, Palantir patterns.

### The Enterprise Pitch
> "Your AI, your data boundaries, our workflow."

This positions GovAffairs *against in-house builds*, not against other SaaS. Large firms will spend 12–18 months and seven figures building something worse than what GovAffairs provides, because they don't have lobbyist-specific product expertise. The BYOK / VPC tiers let them get the workflow without giving up the security boundary. Much easier sale to the GC and CISO than "trust our SOC 2 report."

---

## V2 Concepts (Forward-Looking, Validated by Adam Feedback)

These are the strategic directions identified during V1 build. Each requires customer validation before construction — Adam's feedback is the gating event.

### Reader Annotation / Two-Way Feedback
The brief is currently a one-way artifact. Adding reader annotation inverts this: the client highlights a section, leaves a note ("let's discuss this Tuesday" / "loop in our GC"), and the lobbyist receives that signal *before* the next meeting.

**Strategic value:** the lobbyist arrives at the call already knowing what the client is leaning toward. This changes how the lobbyist prepares — which is the real product. The brief isn't the deliverable; the conversation that follows is.

**Design constraint:** annotation tools usually feel work-y and clutter clean reading. Hide by default. Cursor change on hover. Small comment glyph in right gutter. Notion-style, not Word-style.

### Right-Side Citation Panel
Click a [2] citation → docked rail opens showing the relevant source excerpt + "Open original" + "Ask a question about this source." Better than hover preview (mobile-friendly, persists, allows multiple actions). Notion / Linear pattern.

This is the right V2 of the trust layer — it lets a citation become a launching pad for deeper engagement rather than a static footnote.

### Client Context Profile (the unifying V2 architecture)
The single most important V2 concept. Today the `clients` table has a name and a free-text context field. V2 expands this into a structured profile that **accumulates per-client knowledge over time**:

- **Preferred sources** (which agencies, journalists, think tanks does this client trust?)
- **Non-negotiables** (what would close doors for this client?)
- **Stated commitments** (ESG, regulatory posture, public positions on file)
- **Relationship history** (who in government has this client engaged with? What's the disposition?)

Each brief either *uses* the profile (pre-fills sources, injects non-negotiables) or *updates* it ("Adam added a new non-negotiable mid-brief — save to profile?").

The brief stops being a one-off artifact and becomes a *snapshot of an ongoing relationship between the lobbyist, the client, and the political landscape*.

This is also the unifying architecture for several other V2 features (source recommendations, non-negotiables, enterprise integrations). Building the Client Context Profile is the highest-leverage V2 architectural move.

### Non-Negotiables ("Lines You Can't Cross")
A new brief section between **Stakes Across Three Dimensions** and **Questions Worth Sitting With**. Three to five bullets, each formatted as:

> Don't [action]. Consequence: [outcome]. [citation if applicable]

Example:
> Don't publicly oppose the adversary capital screening language before markup. Chairman Rogers has staked his reputation on industrial base provisions and will read public opposition as a personal slight. Loss of access to HASC majority staff for the remainder of FY27. [2]

This is the most defensible part of lobbyist advice. The factual summary in "The Situation" is something ChatGPT can produce. The Three Ways to Respond is something a smart MBA can produce. But "if you do this, the chairman will personally freeze you out for two cycles" is *experiential knowledge* — it lives in relationships and history.

**Implementation rule: sourced from lobbyist input, not AI inference.** Hallucinating prohibitions is worse than omitting them. The lobbyist enters the constraints; Claude expands them with source context. AI is the writer, not the strategist.

Hidden in Shareable mode by default (these are internal strategic constraints, not necessarily things to surface to the client in writing).

### Enterprise Integration Points
The V3 integration roadmap. Don't build until customer asks, but design schema to not foreclose:
- **Salesforce** — CRM context per client
- **Microsoft Graph / SharePoint / OneDrive** — firm document repositories
- **Internal knowledge bases** (Glean, Guru, Notion enterprise, Confluence) — for retrieval of internal positions
- **Azure OpenAI / AWS Bedrock** — alternate LLM endpoints for BYOK customers

### "Create Brief from Selected Articles" Workflow Connector (V1.5)
The simplest, highest-ROI V1.5 feature. Adds multi-select checkboxes to News Intelligence article cards, with a sticky "Create Brief from N selected" action bar. Pre-populates URLs in `/briefs/new`. Pure connector value — collapses a three-minute workflow into two clicks.

---

## The Discipline (What's NOT in V1)

This section captures what has been **explicitly deferred**. Re-litigating these wastes time. If a future version of this product builds one of these, that decision should be made deliberately, not by drift.

### Deferred until real customer behavior is observed
- **Reader annotation** (build after watching clients consume V1 briefs — the design depends on what they actually do)
- **Source recommendations** (need usage data to train against)
- **Mobile-native UI** (web-responsive is enough until validated)
- **Custom branding per client** (enterprise feature, not V1)

### Deferred until Adam validates V1
- **Generalized pre-release ingestion** (build only 5–10 agencies Adam names specifically)
- **Multi-language briefs**
- **Industry-specific brief templates** (defense vs. healthcare vs. energy — premature without diverse customer base)
- **Workflow builder**
- **Naming and rebranding decision** (defer until lobbyists' actual language sharpens the value props)

### Deferred indefinitely (until strategic reason exists)
- **Predictions module** (already in nav — should be moved to opt-in module)
- **Sports vertical** (separate experiment, not core)
- **Expert marketplace** (the "external policy experts" idea — requires expert database, validation infrastructure, and a commercial relationship layer that don't exist; Apollo discussion confirmed this is closer to V3 than V2)
- **Public brief sharing without email gate**
- **Free tier / freemium model** (the ICP is paying customers; freemium attracts the wrong users)

### Why Discipline Matters
Each deferred feature is:
1. A build cost saved
2. A maintenance burden avoided
3. A customer-validation moment preserved (so you build what they actually want, not what you assumed)

The pre-launch behavior to avoid: building for multiple personas before any has validated.

---

## Validation Strategy

### V1 Validation: Adam Consulting Group
- Single named customer drives V1 polish.
- Two-week test window. Target: roughly June 13, 2026.
- Adam recorded answers to 5 structured questions about his workflow (transcript in progress).
- His feedback directly shapes V1.5 priorities.

### Why Adam-first
One real user beats five hypothetical users. Concrete feedback beats anticipated features. Adam-first reduces feature creep and creates a first reference customer for sales.

### Post-Adam: the second customer
Don't expand to 5 or 10 customers immediately. Find a second named customer with a *different shape* (different practice area, different firm size, different geography). The contrast between two customers reveals what's generalizable vs. what's Adam-specific.

### Lead generation (parallel work)
Apollo.io being evaluated for B2B prospect list of lobbyists/GR directors at target firms. This is for **post-validation outbound**, not for pre-validation customer development. Don't reverse the order.

---

## The Roadmap Stack

### V1 ✅ — Shipped May 30, 2026
- Decision Briefs schema (`briefs`, `brief_sources`, `brief_views`)
- 5-section AI generation via Parallel.ai + Claude Sonnet 4.6
- Trust layer (tier badges + inline citations + source footer)
- Internal vs. Shareable sensitivity modes
- Email-gated public magic link view
- Per-client briefs (using existing impersonation flow)
- Drizzle migrations, run-history tracking

### V1.5 — Target 2 weeks, Adam testing window
- Press release ingestion (5–10 .gov agencies, scoped to what Adam names)
- "Create Brief from Selected Articles" workflow connector
- Client selector dropdown on `/briefs/new` (no impersonation required for Super Admins)
- Backend polish: strip `passwordHash` from `/api/auth/user` response
- CLAUDE.md notes: dev server doesn't auto-restart; env var convention is `AI_INTEGRATIONS_*` prefix

### V2 — Target post-Adam-feedback
- Reader annotation (two-way brief feedback)
- Right-side citation panel
- Client Context Profile (the unifying architectural move)
- Source recommendations
- Non-negotiables brief section
- BYOK / AI provider abstraction
- Production backend deploy on Vercel (currently marketing-only)

### V3+ — Target post-second-customer
- Apollo integration (people enrichment for government targets — "who in government should I call about this")
- Expert recommendations (only if validated through V2 customer behavior)
- Customer-hosted VPC deployment
- Enterprise integrations (Salesforce, SharePoint, Glean, Bedrock, Azure OpenAI)
- Multi-tenant pricing model

---

## Architectural Principles

These are durable across versions. They apply to every build decision.

### Build the seams before you need them
When a future architectural shift is foreseeable, put the abstraction in place *now*, even if there's only one implementation today. Specific cases:
- **AI provider interface** — enables BYOK without rewrite
- **Source category enum** — enables press releases as additive, not parallel feature
- **Client context as reference OR content** — enables enterprise data-boundary requirements

Cost of putting these in early: hours. Cost of retrofitting later: days or weeks.

### Two product surfaces (Author and Reader)
The brief has two distinct UX surfaces:
- **Author surface** = lobbyist (create, edit, regenerate, send)
- **Reader surface** = client (consume, react, share)

Design them as separate problems, not as a unified UI. V1 nailed the author surface. V2 will need real design investment in the reader surface (annotation, citation panel, search across past briefs).

### Trust layer is not optional
Citations, tier badges, "according to" language, source footer. These are the differentiators from generic AI tools. Hallucinations kill credibility once. The trust layer prevents the failure that kills the platform.

### Lobbyist authors, AI assists
The AI generates the draft. The lobbyist edits. The AI never makes recommendations the lobbyist couldn't defend in their own voice. **Non-negotiables specifically: lobbyist-supplied, AI never invents.**

This is also a marketing position: GovAffairs amplifies the lobbyist's expertise, it doesn't replace it.

### Ship to one, then two, then ten
Don't build for "lobbyists" abstractly. Build for Adam. Then find a contrasting second customer. Then generalize. Customer behavior reorders feature lists faster than founder intuition does.

---

## Naming and Branding

Currently using **GovAffairs** as the working name. Domain is **governmentaffairs.co**.

Candidates considered and rejected:
- Govify.io
- Politicalintel.io
- Politicalintelligence.ai

All rejected because they are **category descriptions** rather than brands. They tell you what the product is, not what it stands for.

Better naming directions to explore:
- **Capitol vernacular**: Quorum, Caucus, Whip, Floor, Hearing, Markup
- **Abstract memorable nouns** (the Stripe / Linear / Notion pattern): short, distinctive, doesn't describe the category but becomes associated with it through use

Decision is **deferred** until post-V1 customer feedback. Lobbyists' actual language and the brand reaction from early customers will inform what resonates. Naming before validation risks committing to a brand that doesn't match the eventual positioning.

---

## Vendor & Infrastructure Summary

### Currently in use
| Vendor | Role | Notes |
|---|---|---|
| Supabase | Postgres + Auth | Pro tier, us-west-2 |
| Vercel | Hosting (marketing site) | Backend deploy deferred |
| Parallel.ai | Search + Extract APIs | Replaces Firecrawl for briefs |
| Anthropic | Claude Sonnet 4.6 (briefs), Opus 4.8 (architecture/debug) | Direct SDK in V1; abstraction in V2 |
| LegiStorm | Staffer data (16,753 records) | API dead Jan 2026; data is moat |
| GitHub | Source control | Seeksy-app/Government-Affairs-Intelligence-v2 |

### Under evaluation
- **Apollo.io** — people enrichment for V3 government targets feature

### Deprecated or removed
- **Replit** — migrated off May 6, 2026
- **Firecrawl** — replaced by Parallel.ai for the brief feature

---

## Open Questions for V1.5 and Beyond

These remain undecided. Revisit after Adam's feedback and the analysis of his recorded responses.

1. Does the brief workflow benefit from generating multiple drafts for comparison ("here are three different angles on the same source set — pick one")?
2. Should brief generation be synchronous (lobbyist waits) or async (lobbyist gets notified when done)?
3. How does the client's view of the brief differ across email vs. web vs. mobile? Should the email itself contain the brief, or always link out?
4. What's the right pricing model — per-brief, per-seat, per-client, tiered by features?
5. Should briefs expire after time elapses, or remain permanent?
6. How does versioning work when a brief is regenerated — keep history, overwrite, both? What does the magic link recipient see if the lobbyist regenerates after sending?
7. What happens to a brief when the underlying source URL becomes unreachable (paywall, removal, link rot)? Cached content is in the database — is it served, hidden, or flagged?
8. Should the lobbyist be able to attach a personal voice note or written intro to the magic-link email?

---

## How to Use This Document

**When making a new product decision:** check this doc first. If the decision is consistent with what's here, proceed. If it conflicts, that's a signal to either revise the strategy intentionally or rethink the decision.

**When starting a new CC session:** include this doc in the initial context. CC will inherit the principles and avoid building in directions already deferred.

**When pitching the product:** sections "The Problem," "The Core Product Loop," "Decision Briefs," "The Trust Layer," and "Deployment Models" contain the pitch material. Don't reinvent.

**When onboarding a future teammate:** this doc plus CLAUDE.md should give them enough context to be useful in a week.

This is a living document. Update the version date at the top when material changes are made. Don't delete deferred features — move them between sections as decisions evolve. The history of *why something was NOT built* is as valuable as the history of what was.

## Shipped Week 1 (June 1, 2026)

- Morning Brief V1 — AI-ranked intelligence page (Option B realized one week early)
- Client Profiles schema (4 demo clients populated)
- Suggested Contacts (beta) with staffer keyword matching
- One-click intelligence-to-brief workflow with client context auto-fill
- Press release cron scheduler (production-only, NODE_ENV guarded)
- Dashboard redesign with Morning Brief as hero
- Nav entry for Morning Brief under Intelligence group
- Deep-link from dashboard cards to specific Morning Brief items

Total cost: $1.30 in Anthropic API console.
Total commits today: 4 + dashboard fix in flight.
