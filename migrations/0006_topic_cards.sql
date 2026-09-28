-- Topic cards (Sep 2026). Additive only: two new tables. Safe to run twice.
-- A card is a one-screen summary a firm shares with a client by private link;
-- card_replies holds the client's "Got it" / "I have a question" responses.
-- Run in the Supabase SQL Editor (project wogcfejomgyjgbaosdyg) BEFORE deploy.

CREATE TABLE IF NOT EXISTS topic_cards (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brief_id varchar,
  firm_client_id varchar,
  share_token text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by_user_id varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  shared_at timestamp,
  revoked_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS topic_cards_share_token_idx ON topic_cards (share_token);
CREATE INDEX IF NOT EXISTS topic_cards_client_id_idx ON topic_cards (client_id);

CREATE TABLE IF NOT EXISTS card_replies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  card_id varchar NOT NULL REFERENCES topic_cards(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text,
  message text,
  created_at timestamp DEFAULT now(),
  seen_at timestamp
);
CREATE INDEX IF NOT EXISTS card_replies_card_id_idx ON card_replies (card_id);

ALTER TABLE topic_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_replies ENABLE ROW LEVEL SECURITY;
