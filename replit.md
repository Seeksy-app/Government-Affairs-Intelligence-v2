# Political Intelligence Platform

## Overview
A multi-tenant SaaS platform designed for political consulting firms. Its primary purpose is to provide tools for tracking political contacts, monitoring career paths, aggregating news, and facilitating AI-powered research. The platform aims to be licensed to government affairs firms, offering a comprehensive suite for political intelligence.

## User Preferences
- Dark/light theme toggle available
- Theme preference saved to localStorage

## System Architecture

### Multi-Tenant Structure
The platform supports multiple client firms, each with isolated data, managed by a Super Admin. Super Admins have platform-level administration capabilities, including client management and client impersonation, accessible via `/admin` routes. Client firm users access their specific functionalities via `/dashboard`, `/contacts`, `/news`, and `/network` routes.

### Tech Stack
- **Frontend**: React, TypeScript, Vite
- **UI**: Shadcn/ui components, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Email/password with session cookies (bcrypt hashing)

### Core Features
- **Contact Management**: Track political contacts, their career histories, and connections.
- **News Aggregation & Analysis**: Monitor political news with filtering, clickable articles, high-intent keyword tracking, and article actions (forward, assign to portals, mark read/delete).
- **Network Visualization**: Graphical representation of relationships and organizations.
- **Congressional Tracking**: Search and manage Members of Congress, track schedules, committee meetings, and floor activity. Includes favoriting members and assigning committee meetings to client portals.
- **House Staff Directory Integration**: Scrapes the official House Telephone Directory (directory.house.gov) for accurate congressional staff data (9,400+ employees). Caches data in `congressional_staff_directory` table. Falls back to AI research when directory data unavailable (e.g., Senate staff). Service: `server/services/house-directory-service.ts`.
- **AI-Powered Research**:
    - **Context-aware Q&A**: AI agent for research documents.
    - **Staffer Research**: AI research on Congressional staffers with source citations.
    - **Career Mapping**: Enrich staffer profiles with LinkedIn career data including history, trajectory analysis, skills, and education.
    - **Content Extraction**: Scrape web pages, extract YouTube transcripts, process PDFs/DOCX.
    - **Entity & Custom Research**: AI agent for researching entities and running custom web queries.
    - **Structured Data Extraction**: Extract specific data points from URLs using schemas.
- **Social Media Tracking**: Track X/Twitter accounts and posts, keyword matching, alerts, engagement metrics, and auto-sync.
- **Influencer Tracking**: Track influencers across multiple platforms (Instagram, YouTube, TikTok, Twitter, Twitch, OnlyFans) with profile enrichment and post tracking.
- **Organization Tracking**: Search, enrich, and track lobbying firms, PACs, think tanks, government agencies, and political organizations using People Data Labs Company Enrichment API. Auto-classifies org type, stores enriched data (industry, employee count, HQ, etc.), supports key people finder via PDL Person Search, and AI-powered intelligence reports via Perplexity. Route: `/organizations`. Schema: `political_organizations` table.
- **Client & Matter Management**: Manage sub-client matters with isolated research folders and track customer relationships with Matter assignment.
- **Google Rank Tracking**: Monitor search rankings using SearchAPI.io's Google Rank Tracking API. Track queries with configurable device (desktop/mobile/tablet) and location, highlight target domain positions, and store historical ranking data. Route: `/rank-tracking`. Schema: `rank_tracked_queries`, `rank_tracking_results` tables. Service: `server/services/searchapi-rank-tracking.ts`.
- **LegiStorm Congressional Staff Directory**: Syncs 12,000+ congressional staffers from LegiStorm API with full and incremental sync support. Caches staffer profiles, position histories, contact info, member associations, and office details. Searchable/filterable via "LegiStorm Directory" tab on staffers page. Schema: `legistorm_staffers`, `legistorm_sync_log` tables. Service: `server/services/legistorm-service.ts`. Admin sync controls restricted to super admins. AI Career Research via Perplexity stores results in `career_research` column on `legistorm_staffers` for persistence and searchability. Career search endpoint: `GET /api/staffers/career-search?q=`. AI Agent queries are automatically augmented with matching career research data from the database.
- **Staffer-Bill Mapping**: Maps staffers to the bills they worked on throughout their career. Supports manual linking and AI-powered discovery via Perplexity. Three views: By Staffer (career positions grouped with bill chips), By Bill (bills with linked staffers), and Timeline (chronological view). Route: `/bill-mapping`. Schema: `staffer_bill_associations` table. Tracks role (drafted, negotiated, floor managed, etc.), position context, confidence level, and source (manual vs AI). AI Discovery enriches searches by cross-referencing LegiStorm employment history with Congress.gov member bills (sponsored + cosponsored) filtered to the staffer's tenure dates, then feeds this context to Perplexity for smarter analysis.

### UI/UX Decisions
- Modern and responsive design using Shadcn/ui and Tailwind CSS.
- Theming options (dark/light) are provided, with user preferences persisted.

## External Dependencies

- **PostgreSQL**: Primary database for all platform data.
- **Resend Email**: For transactional email sending (e.g., daily briefs, research updates).
- **Congress.gov API**: For searching and retrieving data on current Members of Congress.
- **Perplexity AI**: Used for staffer research and general agent queries (`sonar` model).
- **Firecrawl**: For web scraping, URL content extraction, and AI agent research.
- **People Data Labs (PDL)**: For enriching staffer profiles with LinkedIn career data, company enrichment, and person search capabilities. Provides career history, trajectory analysis, skills, education, and organizational intelligence on lobbying firms, PACs, and think tanks.
- **OpenAI API**: For AI research capabilities (via Replit AI Integrations).
- **Influencers Club API**: For tracking and enriching data on social media influencers.
- **SearchAPI.io**: For Google Rank Tracking API — monitors search result rankings with device/location targeting.
- **LegiStorm API**: For congressional staff directory data — provides 12,000+ staffer profiles with position histories, contact information, and member associations. Supports full and incremental sync patterns.

### Modular Feature System
- **Module Management**: Admin page at `/modules` allows enabling/disabling add-on features per client firm via toggle switches. Schema: `modules`, `client_modules` tables.
- **Module Gating**: Sidebar conditionally renders navigation items based on module enablement. Sports nav group only appears when sports module is enabled. Route-level gating redirects users to a disabled state if accessing module routes directly.
- **API**: `GET /api/modules`, `POST /api/modules`, `GET/POST /api/clients/:clientId/modules/:moduleId/enable|disable`, `GET /api/modules/check/:moduleKey`.

### Sports Intelligence Module
- **Teams**: Search, track, and manage professional and college sports teams. Supports league/sport/level filtering. AI-powered team search via Perplexity. Schema: `sports_teams` table.
- **Contacts**: Find and manage contacts at sports organizations. Multi-source people finder (`server/services/sports-people-finder.ts`) chains PDL People Search, Perplexity AI research, and Firecrawl web scraping with deduplication. Results show source attribution (PDL/AI/Web). Schema: `sports_contacts` table.
- **AI Research**: Perplexity-powered research on teams. Firecrawl web scraping for team websites.
- **Outreach Pipeline**: Track partnership outreach status (not_started → researching → targeted → contacted → meeting → partnered/declined).
- Route: `/sports`. Gated by sports module enablement.

### Marketing Intelligence Module
- **Client-Specific**: Enabled exclusively for Adam Consulting Group (Vet Tix account). Gated by module system like Sports module.
- **Dashboard**: Executive summary cards (tickets distributed, members served, signups, donated ad value) with Recharts visualizations.
- **OOH ROI Analysis**: Airport advertising, billboard campaigns, bus shelter programs, and military installation signage with donated value and monthly impressions.
- **Channel Performance**: Signup attribution by channel (email, social, NFL partnerships, OOH, organic) with conversion rates and cost per signup.
- **Conversion Funnel**: 5-stage funnel from website visitors to active attendees with stage-by-stage conversion rates.
- **Partnerships**: NFL team partnerships (Dallas Cowboys, Houston Texans, etc.) with tickets donated, activation events, and tier classification.
- **Earned Media**: Media placements (Fox News, ESPN, Military Times) and Fox News pitch packages ($25K-$100K).
- **AI Strategy**: Perplexity-powered marketing analyst with preset questions and persistent recommendation history.
- Route: `/marketing`. Schema: `marketing_intelligence_data`, `marketing_ai_recommendations` tables. Module key: `marketing_intelligence`.

### Veterans Search Feature
- **Veterans Tab** on Network page: Search for congressional members who are military veterans.
- **Veterans Tab** on Staffers page: Browse veteran staffers and military liaisons from LegiStorm directory with action menus (Add to Contacts, KB, Research Projects, or as Client).
- **Veteran Members**: Uses Perplexity AI to research veteran status of Congress members. Results cached in `veteran_congress_members` table with service branch, rank, years of service, and confidence level.
- **Veteran Staffers**: Keyword-searches LegiStorm staffer data for military-related titles (veteran, military liaison, defense, armed services, etc.). AI career research available per staffer.
- **Batch Research**: Can research up to 20 members at a time via AI. Filters by chamber (House/Senate).
- Routes: `/api/veterans/members`, `/api/veterans/research`, `/api/veterans/batch-research`, `/api/veterans/staffers`.

### Demo Videos
- **Public Demo Page**: Public route at `/demo` displays published demo videos with embedded players (YouTube, Vimeo, Loom supported). Scrolls to top on load.
- **Admin Management**: Super admins manage videos at `/admin/demos` — add, edit, delete, reorder, and toggle publish status. Schema: `demo_videos` table.
- **Landing Page**: "Watch Demo" button in hero section links to `/demo`.
- **Scheduler Finder**: LegiStorm-powered scheduler lookup for Congress members. Searches by title keywords (scheduler, director of operations, office manager, etc.). API: `GET /api/legistorm/scheduler?memberName=`. Service: `findSchedulerForMember()` in `legistorm-service.ts`.