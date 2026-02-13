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

### Veterans Search Feature
- **Veterans Tab** on Network page: Search for congressional members who are military veterans and staffers/liaisons with military backgrounds.
- **Veteran Members**: Uses Perplexity AI to research veteran status of Congress members. Results cached in `veteran_congress_members` table with service branch, rank, years of service, and confidence level.
- **Veteran Staffers**: Keyword-searches LegiStorm staffer data for military-related titles (veteran, military liaison, defense, armed services, etc.).
- **Batch Research**: Can research up to 20 members at a time via AI. Filters by chamber (House/Senate).
- Routes: `/api/veterans/members`, `/api/veterans/research`, `/api/veterans/batch-research`, `/api/veterans/staffers`.