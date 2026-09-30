-- Wording: the app says "SI" (super intelligence) instead of "AI".
-- The Help Center starter articles are only inserted once, so the copies
-- already in the database need the same change as server/services/help-docs.ts.
-- Safe to run more than once.

UPDATE kb_articles
SET content = regexp_replace(content, '\mAI\M', 'SI', 'g'),
    title = regexp_replace(title, '\mAI\M', 'SI', 'g')
WHERE scope = 'client'
  AND slug IN ('setting-up-your-practice', 'adding-your-clients', 'privacy-and-your-data');

UPDATE platform_modules
SET description = regexp_replace(description, '\mAI\M', 'SI', 'g')
WHERE key = 'marketing_intelligence';
