# Newco - Political Intelligence Platform

## Overview
Newco is a multi-tenant SaaS platform for political consulting firms. It provides tools for tracking political contacts, monitoring career paths, and aggregating news. The platform is designed to be licensed to government affairs firms.

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
- **Authentication**: Replit Auth (OIDC)

## Key Features

### For Super Admins
- Platform dashboard with statistics
- Client management (CRUD)
- User overview

### For Client Users
- **Contact Management**: Track political staffers, officials, and lobbyists
- **Career Pattern Analysis**: Track career histories and connections
- **News Aggregation**: Monitor political news with filtering
- **Network Visualization**: View relationships and organizations

## Database Schema

### Core Tables
- `users` - Authenticated users (via Replit Auth)
- `sessions` - User sessions
- `clients` - Client firms that license the platform
- `client_users` - Links users to clients with roles
- `super_admins` - Platform administrators

### Feature Tables
- `contacts` - Political contacts database
- `career_history` - Career timeline for contacts
- `contact_connections` - Relationships between contacts
- `news_articles` - Aggregated news articles

## API Routes

### Authentication
- `GET /api/login` - Initiate login
- `GET /api/logout` - Logout
- `GET /api/auth/user` - Get current user
- `GET /api/user/role` - Get user role (admin/client)

### Admin Routes
- `GET /api/admin/clients` - List all clients
- `POST /api/admin/clients` - Create client
- `PATCH /api/admin/clients/:id` - Update client
- `DELETE /api/admin/clients/:id` - Delete client
- `GET /api/admin/stats` - Platform statistics

### Client Routes
- `GET /api/stats` - Client statistics
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `PATCH /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `GET /api/news` - List news articles
- `POST /api/news` - Add news article
- `PATCH /api/news/:id` - Update article (mark read/flagged)

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run db:push` - Push schema changes to database

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `ISSUER_URL` - OIDC issuer (Replit)

## User Preferences
- Dark/light theme toggle available
- Theme preference saved to localStorage
