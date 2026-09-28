-- Organization profiles (Sep 2026). Additive only: one new table. Safe to run twice.
-- Public facts about an organization (company, association, congressional
-- office…), researched once and reused by every firm.
-- Run in the Supabase SQL Editor (project wogcfejomgyjgbaosdyg) BEFORE deploy.

CREATE TABLE IF NOT EXISTS org_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name_key text NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  fetched_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_profiles_name_key_idx ON org_profiles (name_key);

ALTER TABLE org_profiles ENABLE ROW LEVEL SECURITY;
