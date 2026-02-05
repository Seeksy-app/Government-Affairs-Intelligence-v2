# Political Intelligence Platform

## Overview
A multi-tenant SaaS platform for political consulting firms. It provides tools for tracking political contacts, monitoring career paths, and aggregating news. The platform is designed to be licensed to government affairs firms.

## Future Integrations
- **Gmail Integration**: User dismissed OAuth integration. If email features are needed later, will need to implement with manual API key/credentials from user.
- **Resend Email**: Configured for sending transactional emails (daily briefs, research updates)

## Current State
- **MVP Complete**: The core platform is functional with authentication, multi-tenancy, and all primary features.
- **First Client**: Adam Consulting Group is seeded as the first client with sample data.
- **Super Admin**: The first user to log in becomes the platform super admin.

## Architecture

### Multi-Tenant Structure
- **Super Admin (Newco)**: Platform-level administration
  - Manage client firms
  - View platform-wide statistics
  - Access at `/admin` routes
  
- **Client Firms**: Organizations that license the platform
  - Each client has isolated data
  - Users are assigned to one client
  - Access at `/dashboard`, `/contacts`, `/news`, `/network` routes

### Tech Stack
- **Frontend**: React + TypeScript + Vite
- **UI**: Shadcn/ui components + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Email/password with session cookies (bcrypt hashing)

## Key Features

### For Super Admins
- Platform dashboard with statistics
- Client management (CRUD)
- User overview
- **Client Impersonation**: View the platform as any client to troubleshoot or assist users

### For Client Users
- **Contact Management**: Track political staffers, officials, and lobbyists
- **Career Pattern Analysis**: Track career histories and connections
- **News Aggregation**: Monitor political news with filtering, clickable article links
- **High Intent Keywords**: Track specific terms across news articles with visual highlighting
- **Article Actions**: Forward articles via email, assign to client portals, mark read/delete
- **Network Visualization**: View relationships and organizations
- **Members of Congress Search**: Search current senators and representatives with filters for chamber, party, and state (via Congress.gov API)
- **Staff Persistence**: Selected Congress member and staff data persist in localStorage across page navigations
- **Congress Member Favorites**: Star and save frequently accessed Congress members with Matter assignment
- **Customers Portal**: Track relationship contacts (Congress members, staffers, manual entries) with Matter assignment for organizing outreach
- **Matters (Sub-Clients)**: Manage client matters with isolated research folders
- **AI Research Agent**: Context-aware Q&A from research documents using OpenAI

### AI Research Capabilities (Firecrawl Integration)
- **URL Content Extraction**: Scrape web pages and extract content via Firecrawl
- **YouTube Transcript Extraction**: Get transcripts from YouTube videos
- **Entity Research**: AI agent researches people, organizations, or companies
- **Custom Agent Queries**: Run custom web research queries
- **Structured Data Extraction**: Extract specific data points from URLs using schemas
- **PDF/DOCX Processing**: Upload and process document files

### Social Media Tracking
- **X/Twitter Tracking**: Track X accounts and posts via Firecrawl scraping
- **Keyword Matching**: Filter posts by keywords (global or per-account)
- **Keyword Alerts**: Get notified when tracked accounts mention specific keywords
- **Engagement Metrics**: Track likes, reposts, and replies over time with historical data
- **Auto-Sync**: Scheduled automatic syncing of tracked accounts at configurable intervals
- **Influencer Tracking** (Influencers Club API): Track influencers across multiple platforms
  - Platforms: Instagram, YouTube, TikTok, Twitter, Twitch, OnlyFans
  - Profile enrichment: followers, engagement rate, bio, recent posts
  - Post tracking with engagement metrics

## Database Schema

### Core Tables
- `users` - Authenticated users with password hash
- `sessions` - User sessions (PostgreSQL-backed)
- `clients` - Client firms that license the platform
- `client_users` - Links users to clients with roles
- `super_admins` - Platform administrators
- `pending_signups` - Self-service signup requests with email verification tokens
- `password_reset_tokens` - Password reset tokens (1 hour expiry)

### Feature Tables
- `contacts` - Political contacts database
- `career_history` - Career timeline for contacts (includes organizationType, policyAreas, supervisor)
- `contact_connections` - Relationships between contacts
- `news_articles` - Aggregated news articles
- `matters` - Sub-client matters for organizing research
- `research_documents` - Extracted content from URLs, YouTube, PDFs, and agent queries
- `research_conversations` - AI conversation sessions per matter
- `research_messages` - Messages in research conversations
- `tracked_social_accounts` - X/Twitter accounts to track
- `social_tracking_keywords` - Keywords to filter posts
- `tracked_social_posts` - Scraped posts from tracked accounts
- `social_engagement_history` - Historical engagement metrics per sync
- `social_keyword_alerts` - Notifications when keywords are matched
- `social_auto_sync_config` - Auto-sync configuration per client
- `tracked_influencers` - Influencers tracked via Influencers Club API
- `influencer_posts` - Posts from tracked influencers
- `customers` - Customer relationships (Congress members, staffers, manual contacts) with Matter assignment
- `favorites` - Favorited Congress members for quick access
- `rss_feed_client_assignments` - Links RSS feeds to specific clients for client portal access
- `high_intent_keywords` - Keywords for highlighting high-priority news articles
- `news_article_portal_assignments` - Links news articles to client portals

## API Routes

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/logout` - Logout (destroys session)
- `POST /api/auth/set-password` - Set password after email verification
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/user` - Get current user
- `GET /api/user/role` - Get user role (admin/client)
- `POST /api/client-signup` - Self-service client signup (sends verification email)
- `GET /api/verify-email` - Verify email with token

### Admin Routes
- `GET /api/admin/clients` - List all clients
- `POST /api/admin/clients` - Create client
- `PATCH /api/admin/clients/:id` - Update client
- `DELETE /api/admin/clients/:id` - Delete client
- `GET /api/admin/stats` - Platform statistics
- `POST /api/admin/impersonate/:clientId` - Start impersonating a client
- `POST /api/admin/stop-impersonate` - Stop impersonating

### Client Routes
- `GET /api/stats` - Client statistics
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `PATCH /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `GET /api/news` - List news articles
- `POST /api/news` - Add news article
- `PATCH /api/news/:id` - Update article (mark read/flagged)
- `DELETE /api/news/:id` - Delete article
- `POST /api/news/:articleId/forward` - Forward article via email
- `GET /api/news/:articleId/assignments` - Get article portal assignments
- `POST /api/news/:articleId/assign-portal` - Assign article to portal
- `DELETE /api/news/:articleId/assign-portal/:portalId` - Unassign article from portal

### High Intent Keywords Routes
- `GET /api/high-intent-keywords` - List keywords for client
- `POST /api/high-intent-keywords` - Create keyword
- `PATCH /api/high-intent-keywords/:id` - Update keyword
- `DELETE /api/high-intent-keywords/:id` - Delete keyword

### Matters Routes
- `GET /api/matters` - List matters for client
- `POST /api/matters` - Create matter
- `GET /api/matters/:id` - Get single matter
- `PATCH /api/matters/:id` - Update matter
- `DELETE /api/matters/:id` - Delete matter

### Research Routes
- `GET /api/matters/:matterId/documents` - Get documents for matter
- `POST /api/matters/:matterId/documents/url` - Add document from URL (Firecrawl/YouTube)
- `DELETE /api/documents/:id` - Delete document
- `GET /api/matters/:matterId/conversations` - Get conversations
- `POST /api/matters/:matterId/conversations` - Create conversation
- `GET /api/conversations/:convId/messages` - Get messages
- `POST /api/conversations/:convId/chat` - Send message (SSE streaming)
- `POST /api/matters/:matterId/research/entity` - Research entity via Firecrawl agent
- `POST /api/matters/:matterId/research/extract` - Extract structured data from URLs
- `POST /api/matters/:matterId/research/agent-query` - Run custom agent query
- `GET /api/contacts/:contactId/career-analysis` - AI career analysis

### Congress API Routes
- `GET /api/congress/members` - Search current Members of Congress (filters: search, chamber, party, state)
- `GET /api/congress/members/:bioguideId` - Get detailed info for a specific member

### Customers Routes
- `GET /api/customers` - List customers for client
- `GET /api/customers/:id` - Get single customer
- `GET /api/customers/by-matter/:matterId` - Get customers for a specific matter
- `GET /api/customers/check/:sourceType/:sourceId` - Check if a customer already exists
- `POST /api/customers` - Create customer
- `PATCH /api/customers/:id` - Update customer (including matter assignment)
- `DELETE /api/customers/:id` - Delete customer

### Favorites Routes
- `GET /api/favorites` - List favorited Congress members
- `POST /api/favorites` - Add Congress member to favorites
- `PATCH /api/favorites/:id` - Update favorite (including matter assignment)
- `DELETE /api/favorites/:id` - Remove from favorites
- `GET /api/favorites/check/:bioguideId` - Check if member is favorited

### Influencer Tracking Routes
- `GET /api/influencers` - List tracked influencers
- `POST /api/influencers` - Add influencer to track (enriches via Influencers Club API)
- `PATCH /api/influencers/:id` - Update influencer
- `DELETE /api/influencers/:id` - Remove influencer
- `POST /api/influencers/:id/sync` - Refresh influencer data from API
- `GET /api/influencers/posts` - Get all influencer posts
- `GET /api/influencers/:id/posts` - Get posts for specific influencer
- `PATCH /api/influencer-posts/:id/read` - Mark post as read
- `PATCH /api/influencer-posts/:id/flag` - Toggle post flag
- `GET /api/influencers/credits` - Check API credits

### RSS Feed Client Assignment Routes
- `GET /api/rss-feeds/:id/assignments` - Get client assignments for a feed
- `POST /api/rss-feeds/:id/assignments` - Assign feed to a client
- `DELETE /api/rss-feeds/:feedId/assignments/:clientId` - Remove feed from client
- `GET /api/client/assigned-feeds` - Get feeds assigned to current client

### Public Client Portal Routes
- `GET /api/public/portal/:clientSlug/:portalSlug` - Get portal info
- `GET /api/public/portal/:clientSlug/:portalSlug/matters` - Get portal matters
- `GET /api/public/portal/:clientSlug/:portalSlug/news` - Get news from assigned feeds
- `GET /api/public/portal/:clientSlug/:portalSlug/bills` - Get tracked bills for client
- `GET /api/public/portal/:clientSlug/:portalSlug/stats` - Get portal statistics
- `POST /api/public/portal/:clientSlug/:portalSlug/conversations/:convId/chat` - AI chat (SSE streaming)

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `ISSUER_URL` - OIDC issuer (Replit)
- `FIRECRAWL_API_KEY` - Firecrawl API key for web scraping and agent queries
- `INFLUENCERS_API_KEY` - Influencers Club API key for influencer tracking
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (via Replit AI Integrations)

## User Preferences
- Dark/light theme toggle available
- Theme preference saved to localStorage
