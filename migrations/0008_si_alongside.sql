-- Wording, part 2: the "Technology & AI" policy area is now
-- "Technology, AI & SI", and the Help Center spells out "super intelligence".
-- Safe to run more than once.

UPDATE client_profiles
SET industries = array_replace(industries, 'Technology & AI', 'Technology, AI & SI')
WHERE 'Technology & AI' = ANY(industries);

UPDATE firm_clients
SET industries = array_replace(industries, 'Technology & AI', 'Technology, AI & SI')
WHERE 'Technology & AI' = ANY(industries);

UPDATE kb_articles
SET content = replace(content, '**Comfort with SI** changes', '**Comfort with SI** (super intelligence) changes')
WHERE scope = 'client' AND slug = 'setting-up-your-practice'
  AND content NOT LIKE '%(super intelligence)%';

UPDATE kb_articles
SET content = replace(content, 'drafted with SI from cited', 'drafted with SI (super intelligence) from cited')
WHERE scope = 'client' AND slug = 'privacy-and-your-data'
  AND content NOT LIKE '%(super intelligence)%';
