import { count, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { kbArticles, kbCategories } from "@shared/schema";

// Starter help center (the Knowledge Base, client scope). Inserted once, when
// no help articles exist, so admin edits and deletions made at /admin/kb are
// never overwritten. Keep the wording plain and true to what the app does.

type Doc = { slug: string; title: string; summary: string; content: string };
export const HELP: Array<{ name: string; description: string; docs: Doc[] }> = [
  {
    name: "Getting started",
    description: "How the app is laid out and how to set it up for your practice.",
    docs: [
      {
        slug: "welcome",
        title: "Welcome: how GovernmentAffairs.io is organized",
        summary: "The top bar, the left rail, and the Today page in two minutes.",
        content: `GovernmentAffairs.io helps you answer two questions fast: **should my client be worried about this?** and **who do I need to reach?**

## The top bar
- **News**, **Press** and **Should I be worried?** show a small number when something new arrived today: important stories for your firm, releases from your agencies, and answers written today.
- **Markets** shows prediction-market odds on elections and policy outcomes.
- **Research assistant** opens a chat panel for quick questions, including searching the congressional staff directory.
- **Search** (or press ⌘K) finds bills, staff and contacts.
- **Settings** and your account are in the top-right corner.

## The left rail
**Today** is home. **People** holds contacts, your clients, the staff directory, members of Congress and client portals. **Strategy** and **Research** are for planning outreach and collecting material. **Bills** and **Hearings** follow legislation. **Help** is this page.

## Today
Your morning brief: the news and agency releases that matter to your firm, ranked, with your latest "Should I be worried?" answers, your shortcuts, D.C. weather and the at-a-glance counts.`,
      },
      {
        slug: "setting-up-your-practice",
        title: "Setting up your practice",
        summary: "What the setup questions change, and how to edit your answers later.",
        content: `Setup takes about ten minutes and every answer changes something you'll see.

## Your practice
- **Policy areas** and **specific issues** decide which news ranks highest for you. Specific issues ("overtime rule", "TRICARE") count the most.
- **Agencies** fill your Press page with their releases, and stories that name them rank higher.
- **Committees** raise stories about those panels.
- **States** add storm, fire and disaster alerts for those states to Weather watch.

## How you work
- **What makes clients call** (a headline, a markup, a proposed rule…) tilts your morning brief toward those moments.
- **Weather** decides where the alerts card sits on Today (the D.C. forecast always shows).
- **Prediction markets** can be shown on Today or kept under Markets.
- **Comfort with AI** changes how answers are presented to you.

## Changing answers
Go to **Settings → Practice & Today**. You'll see every answer at a glance with an **Edit** link, plus quick switches for weather alerts and prediction markets.`,
      },
      {
        slug: "adding-your-clients",
        title: "Adding your clients",
        summary: "The four short layers per client, and why the never-say list matters.",
        content: `Tell us about the clients you represent and every answer about them gets more useful. Open **People → Your Clients** (or **Settings → Manage clients**).

Each client has four short layers:
1. **Who they are:** name, main business and industries.
2. **Your relationship:** your goals with them, what shapes the relationship, and where friction comes up.
3. **How to talk with them:** whether Today should suggest questions about them, **what never to say**, and how they'd feel about AI helping with work you share.
4. **How they see your work:** a secure portal, direct contact, or a mix you control.

## The never-say list
Words, framings, topics or names to stay away from. Every answer written about that client treats the list as a hard rule. It's private to your firm and never shown to the client.

## Writing help
The ✨ button on the longer answers can write a draft (leaving [blanks] for facts only you know), polish, shorten or lengthen what you wrote. Undo puts your text back.

## Portals
If you choose a portal, we set one up **switched off**, so the client's name stays private until you turn it on under **People → Client Portals**.`,
      },
    ],
  },
  {
    name: "Today & the morning brief",
    description: "Reading your ranked brief, Weather watch and shortcuts.",
    docs: [
      {
        slug: "reading-your-morning-brief",
        title: "Reading your morning brief",
        summary: "How items are chosen and ranked, and what the scores mean.",
        content: `Each brief ranks the last 48 hours of news and agency press releases against your firm's profile (it looks back a week on quiet days).

- **Top priorities** are items worth acting on or reading today.
- **Worth watching** are related developments to keep an eye on.
- The **score** (out of 100) is how closely an item matches your policy areas, issues, agencies and committees, with extra weight for real policy action: votes, rules, funding, hearings.
- Click any item for the summary, why it matters, and a one-click **Should I be worried?** answer about it.

The page shows your latest ranking immediately and refreshes it in the background. **Refresh** in the banner asks for a brand-new ranking right now.

Seeing the wrong kind of stories? Tune your policy areas and issues in **Settings → Practice & Today**.`,
      },
      {
        slug: "weather-watch",
        title: "Weather watch",
        summary: "The D.C. forecast, federal office status, and alerts for your states.",
        content: `The banner on Today shows the **Washington, D.C. forecast** and whether **federal offices are open** (from OPM). Forecasts come from AccuWeather or the National Weather Service.

The **Weather watch** card lists what could move a vote, a hearing or a fly-in, or hit your clients:
- Severe weather alerts from the National Weather Service
- Tropical storms and hurricanes from the National Hurricane Center
- New FEMA disaster declarations

Alerts tagged **Your state** are for the states in your profile, your contacts' states and your tracked state bills.

Choose where the card sits, or turn it off, in **Settings → Practice & Today → Weather alerts**. The D.C. forecast always stays in the banner.`,
      },
      {
        slug: "shortcuts",
        title: "Shortcuts and at-a-glance counts",
        summary: "Pin the pages you use most to Today.",
        content: `Under **Should I be worried?** on Today, **Shortcuts** puts your favorite pages one click away. Click **Customize** to pin up to six: Staff Directory, Tracked Bills, Hearings, Contacts, Members of Congress, Your Clients, Power Search, Strategy Board, Research Projects, Bill Mapping, Client Portals, News, Press Releases or Prediction Markets.

**At a glance** on the right counts your tracked bills (and new updates), your questions, contacts and the congressional staff directory. Click a row to jump there.`,
      },
    ],
  },
  {
    name: "Should I be worried?",
    description: "Calm, cited answers to the questions clients ask.",
    docs: [
      {
        slug: "asking-should-i-be-worried",
        title: "Asking \"Should I be worried?\"",
        summary: "How to ask, what you get back, and what the concern levels mean.",
        content: `Paste a headline, a link or a bill number, or just type the question. We find the sources (Congress.gov, agency press releases and trusted news) and write a calm answer in about a minute. Every statement cites its source.

## Asking about a client
Pick the client under **About**. The answer uses their business and goals, steers around their friction points, and follows their never-say list.

## What you get
- **The bottom line**, with a concern level:
  - **Low concern:** early, speculative or unlikely to reach them.
  - **Worth watching:** real and moving; the answer names the trigger to watch for.
  - **Act now:** advancing with real exposure; time to engage.
- The situation, why it matters, the stakes, sharp questions to ask, and cautious, moderate and assertive response options.

## Get ahead of it
Clients you marked "get ahead of it" get a suggested question on Today, so you can have the answer before they call.

Each firm can ask up to 40 questions a day.`,
      },
      {
        slug: "sharing-an-answer",
        title: "Sharing an answer with a client",
        summary: "Internal versus shareable, and the share link.",
        content: `Every answer starts **Internal**: frank and written for your team. Switch it to **Shareable** for a polished version suitable for a client, then use **Share link** to copy a link you can send.

Read it before you send it. You know the client; the answer is a strong first draft backed by its sources.`,
      },
      {
        slug: "research-assistant",
        title: "Using the Research assistant",
        summary: "Quick questions and staff lookups from any page.",
        content: `Open **Research assistant** from the top bar, or **Ask a question** on Today. It answers quick questions and can search the congressional staff directory: ask "who handles veterans issues for Senator X?" and you'll get staff cards with email and a LinkedIn search.

For a cited answer you can share with a client, use **Should I be worried?** instead.`,
      },
    ],
  },
  {
    name: "People, bills & hearings",
    description: "Finding staff, tracking legislation and following agencies.",
    docs: [
      {
        slug: "finding-congressional-staff",
        title: "Finding congressional staff",
        summary: "The Staff Directory and what's in it.",
        content: `**People → Staff Directory** covers roughly 16,700 current congressional staffers, with email addresses for most. Search by name, office, title or issue ("legislative director", "veterans"), then email directly or search LinkedIn from the staff card.

Tip: pin **Staff Directory** to Today with **Shortcuts → Customize**.`,
      },
      {
        slug: "tracking-bills",
        title: "Tracking federal and state bills",
        summary: "Following legislation and seeing what changed.",
        content: `Open **Bills → Tracked Bills** and use the **Federal / State** switch.

- **Federal** bills come from Congress.gov.
- **State** bills come from LegiScan (credited on the page, as their license requires).

Tracked bills are checked for changes every six hours (new actions and status changes), and the change history is kept on each bill. New updates also show under **At a glance** on Today.`,
      },
      {
        slug: "press-releases-and-news",
        title: "Press releases and news",
        summary: "Where agency releases come from and how news is ranked.",
        content: `**Press** shows releases from the agencies in your profile: currently VA, Defense, HHS, CMS, FDA, Labor, Treasury, Homeland Security, NIST and the White House. They're collected every six hours. Use the search box to find releases by keyword.

**News** gathers stories from trusted outlets and ranks them for your firm. A story scores high when it hits your specific issues, names your agencies or committees in the headline, and describes real policy action.

Agency missing? Add it in **Settings → Practice & Today → Agencies**, and tell us if we don't collect its releases yet.`,
      },
    ],
  },
  {
    name: "Account & settings",
    description: "Your profile, your firm, and your data.",
    docs: [
      {
        slug: "settings-and-profile",
        title: "Settings and your profile",
        summary: "Editing your name and firm details, inviting colleagues, signing out.",
        content: `Open **Settings** from the gear in the top-right corner.

- **Profile:** edit your first and last name. Your email is how you sign in.
- **Firm:** name, address and phone. Firm admins can edit these; members see them read-only.
- **Practice & Today:** your setup answers, with quick switches for weather alerts and prediction markets.
- **Sign-up link:** for someone who wants their own firm account. To add a colleague to *your* firm, email support@governmentaffairs.io.
- **Appearance:** light or dark mode.

Forgot your password? Use **Forgot password** on the sign-in page and we'll email you a reset link.`,
      },
      {
        slug: "privacy-and-your-data",
        title: "Privacy and your data",
        summary: "Who sees your answers, clients and questions.",
        content: `- Your profile, clients, never-say lists and questions belong to your firm's account. They aren't shown to other firms or to your clients.
- Client portals start **switched off** and only show what you choose to share.
- Answers and briefs are drafted with AI from cited public sources. Always review before sharing.
- The staff directory, bills, press releases and news come from public and licensed sources shared by everyone on the platform.`,
      },
    ],
  },
];

export async function ensureHelpDocs(): Promise<number> {
  // One transaction (all or nothing) under an advisory lock, so two instances
  // booting together during a deploy can't both seed.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(74031)`);
    const [{ n }] = await tx.select({ n: count() }).from(kbArticles).where(eq(kbArticles.scope, "client"));
    if (Number(n) > 0) return 0;
    let inserted = 0;
    for (let i = 0; i < HELP.length; i++) {
      const group = HELP[i];
      const [cat] = await tx
        .insert(kbCategories)
        .values({ scope: "client", name: group.name, description: group.description, sortOrder: i })
        .returning({ id: kbCategories.id });
      // Inserted in reading order; the help page lists a category's articles oldest first.
      for (const d of group.docs) {
        await tx.insert(kbArticles).values({ scope: "client", categoryId: cat.id, isPublished: true, ...d });
        inserted++;
      }
    }
    return inserted;
  });
}
