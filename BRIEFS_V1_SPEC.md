# Decision Briefs — V1 Feature Spec

> **Source of truth.** Do not deviate without sign-off from Andrew.
> AI-generated decision briefs that lobbyists send to their clients via
> email-gated magic links.

## Brief structure (5 sections, opinionated and enforced)

- **"The Situation"** — 2-3 sentence factual summary
- **"Why It Matters to You"** — 3-4 sentences specific to client context
- **"Stakes Across Three Dimensions"** — business / reputational / values
- **"Questions Worth Sitting With"** — 3-5 sharp prompts
- **"Three Ways to Respond"** — cautious / moderate / aggressive options

## Lobbyist input on each brief

- Topic/title
- Up to 5 source URLs (article links the lobbyist picked)
- Sensitivity toggle: "Internal" (hedged, frank) vs "Shareable" (polished, on-message)
- Client context (free-text field, becomes part of system prompt)
- AI model: Claude Sonnet 4.6 (hardcoded for V1, store `model_used` on brief record
  for future flexibility)

## Source ingestion (Parallel.ai)

- **Search API + Extract API** for V1.
  - **Extract API** pulls the exact content of each lobbyist-provided source URL
    (URL → clean markdown) — this is the primary grounding material for the brief.
  - **Search API** supplements with topic-level context (objective + keyword
    queries, biased toward the provided source domains).
- **Task API is explicitly OUT of V1.**

## Trust layer (THE critical feature, build this carefully)

- Every factual claim gets inline citation `[1]`, `[2]`, etc.
- Source tier badges hardcoded for V1:
  - **Tier 1:** Reuters, AP, WSJ, NYT, Bloomberg, .gov sources
  - **Tier 2:** Politico, The Hill, Defense News, Roll Call, Axios
  - **Tier 3:** blogs, op-eds, think tanks, opinion pieces
- AI system prompt constrains Claude to only state facts directly supported by
  source material; phrases like "according to [source]" used liberally
- Brief footer lists every source with publication date + tier badge

## Email-gated public view

- Public UUID URL: `/brief/{uuid}`
- First visit prompts for email
- View tracking: store email + every visit timestamp in `brief_views`
- Lobbyist dashboard shows "Viewed by alice@client.com, 3 views, last Sat 1:42pm"

## Out of scope for V1 (do NOT build these even if tempted)

- Nav redesign or modules system changes
- Predictions feature removal
- **Parallel.ai Task API integration** (Search API + Extract API only for V1)
- Tier-based model selection by plan
- AI-assisted source discovery (lobbyist provides URLs manually)
- Workflow builder of any kind
- Auth integration for the public brief view (email gate is enough for V1)
