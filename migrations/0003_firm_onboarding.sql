-- Firm onboarding (Sep 2026). Additive only: three columns on client_profiles
-- and a new firm_clients table. Safe to run more than once.
-- Run in the Supabase SQL Editor (project wogcfejomgyjgbaosdyg) BEFORE the
-- code that uses it deploys.

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS states text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamp;

CREATE TABLE IF NOT EXISTS firm_clients (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  business text,
  industries text[] NOT NULL DEFAULT '{}'::text[],
  goals text,
  relationship text,
  friction text,
  proactive text NOT NULL DEFAULT 'ask',
  avoid text,
  ai_comfort text,
  sharing text NOT NULL DEFAULT 'mix',
  portal_id varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS firm_clients_client_id_idx ON firm_clients (client_id);

-- Supabase exposes public tables over its REST API; this app only uses the
-- direct Postgres connection, so keep the new table locked to that path.
ALTER TABLE firm_clients ENABLE ROW LEVEL SECURITY;
