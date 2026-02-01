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
- **News Aggregation**: Monitor political news with filtering
- **Network Visualization**: View relationships and organizations
- **Matters (Sub-Clients)**: Manage client matters with isolated research folders
- **AI Research Agent**: Context-aware Q&A from research documents using OpenAI

### AI Research Capabilities (Firecrawl Integration)
- **URL Content Extraction**: Scrape web pages and extract content via Firecrawl
- **YouTube Transcript Extraction**: Get transcripts from YouTube videos
- **Entity Research**: AI agent researches people, organizations, or companies
- **Custom Agent Queries**: Run custom web research queries
- **Structured Data Extraction**: Extract specific data points from URLs using schemas
- **PDF/DOCX Processing**: Upload and process document files

## Database Schema

### Core Tables
- `users` - Authenticated users with password hash
- `sessions` - User sessions (PostgreSQL-backed)
- `clients` - Client firms that license the platform
- `client_users` - Links users to clients with roles
- `super_admins` - Platform administrators
- `pending_signups` - Self-service signup requests with email verification tokens

### Feature Tables
- `contacts` - Political contacts database
- `career_history` - Career timeline for contacts (includes organizationType, policyAreas, supervisor)
- `contact_connections` - Relationships between contacts
- `news_articles` - Aggregated news articles
- `matters` - Sub-client matters for organizing research
- `research_documents` - Extracted content from URLs, YouTube, PDFs, and agent queries
- `research_conversations` - AI conversation sessions per matter
- `research_messages` - Messages in research conversations

## API Routes

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/logout` - Logout (destroys session)
- `POST /api/auth/set-password` - Set password after email verification
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

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `ISSUER_URL` - OIDC issuer (Replit)
- `FIRECRAWL_API_KEY` - Firecrawl API key for web scraping and agent queries
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL (via Replit AI Integrations)

## User Preferences
- Dark/light theme toggle available
- Theme preference saved to localStorage
