-- Team invites (Sep 2026). Additive only: one new table. Safe to run twice.
-- Run in the Supabase SQL Editor (project wogcfejomgyjgbaosdyg) BEFORE the
-- code that uses it deploys.

CREATE TABLE IF NOT EXISTS firm_invites (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token_hash text NOT NULL,
  invited_by_user_id varchar,
  created_at timestamp DEFAULT now(),
  expires_at timestamp NOT NULL,
  accepted_at timestamp,
  accepted_user_id varchar,
  revoked_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS firm_invites_token_hash_idx ON firm_invites (token_hash);
CREATE INDEX IF NOT EXISTS firm_invites_client_id_idx ON firm_invites (client_id);

-- Only the app's direct Postgres connection touches this table.
ALTER TABLE firm_invites ENABLE ROW LEVEL SECURITY;

-- Help Center: the seeded "Settings and your profile" article described the
-- old sign-up link; point it at Team invites instead. Harmless to re-run.
UPDATE kb_articles
SET content = replace(
      content,
      '- **Sign-up link:** for someone who wants their own firm account. To add a colleague to *your* firm, email support@governmentaffairs.io.',
      '- **Team:** see who''s at your firm. Admins invite colleagues by email (the link works once and expires in 7 days), change roles and remove people. The sign-up link below it is for someone who wants their own, separate firm account.'
    ),
    updated_at = now()
WHERE slug = 'settings-and-profile' AND scope = 'client';
