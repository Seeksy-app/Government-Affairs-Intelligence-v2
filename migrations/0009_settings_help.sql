-- Help Center: the Settings article now matches the new layout (account
-- menu instead of the gear, profile photo, Integrations; no Appearance or
-- Account sections). Starter articles are only inserted once, so the copy
-- already in the database needs this update. Safe to run more than once.

UPDATE kb_articles
SET summary = 'Your photo and name, firm details, inviting colleagues, integrations, signing out.',
    content = $help$Click your picture or initials in the top-right corner for **Settings**, **Sources**, **Security** and **Log out**. The moon/sun button next to it switches light and dark mode.

- **Profile:** add or change your photo (click the circle), and edit your first and last name. Your email is how you sign in.
- **Firm:** name, address and phone. Firm admins can edit these; members see them read-only.
- **Practice & Today:** your setup answers, with quick switches for weather alerts and prediction markets.
- **Team:** see who's at your firm. Admins invite colleagues by email (the link works once and expires in 7 days), change roles and remove people. The sign-up link below it is for someone who wants their own, separate firm account.
- **Integrations:** which data sources are switched on for you, and tools you can connect, like Miro.

Forgot your password? Use **Forgot password** on the sign-in page and we'll email you a reset link.$help$
WHERE scope = 'client' AND slug = 'settings-and-profile';
