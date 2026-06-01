import { db } from "../server/db";
import { clients, clientProfiles } from "../shared/schema";
import { eq } from "drizzle-orm";

const ADAM_CLIENT_ID = "2cde8abd-7294-4493-b02a-3eac06f0d59e";

async function main() {
  console.log("Seeding demo clients and client profiles...");

  // ── 1. Insert three demo clients ────────────────────────────────────────────

  const [veteransClient] = await db
    .insert(clients)
    .values({
      name: "Veterans Benefits Coalition",
      slug: "veterans-benefits-coalition",
      industry: "veterans services",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning({ id: clients.id, name: clients.name });

  const [infrastructureClient] = await db
    .insert(clients)
    .values({
      name: "Mid-Atlantic Infrastructure Partners",
      slug: "mid-atlantic-infrastructure-partners",
      industry: "infrastructure",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning({ id: clients.id, name: clients.name });

  const [healthcareClient] = await db
    .insert(clients)
    .values({
      name: "Northeast Healthcare Systems Alliance",
      slug: "northeast-healthcare-systems-alliance",
      industry: "healthcare",
      isActive: true,
    })
    .onConflictDoNothing()
    .returning({ id: clients.id, name: clients.name });

  // If conflict, fetch existing
  const veteransId =
    veteransClient?.id ??
    (
      await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.slug, "veterans-benefits-coalition"))
        .limit(1)
    )[0]?.id;

  const infrastructureId =
    infrastructureClient?.id ??
    (
      await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.slug, "mid-atlantic-infrastructure-partners"))
        .limit(1)
    )[0]?.id;

  const healthcareId =
    healthcareClient?.id ??
    (
      await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.slug, "northeast-healthcare-systems-alliance"))
        .limit(1)
    )[0]?.id;

  if (!veteransId || !infrastructureId || !healthcareId) {
    throw new Error("Failed to create or find demo clients");
  }

  console.log(`Veterans Benefits Coalition: ${veteransId}`);
  console.log(`Mid-Atlantic Infrastructure Partners: ${infrastructureId}`);
  console.log(`Northeast Healthcare Systems Alliance: ${healthcareId}`);

  // ── 2. Insert client profiles ────────────────────────────────────────────────

  const profiles = [
    {
      clientId: ADAM_CLIENT_ID,
      industries: ["veterans services", "healthcare", "infrastructure"],
      watchlistTopics: [
        "veterans benefits expansion",
        "VA mental health funding",
        "GI Bill",
        "community care",
        "suicide prevention",
        "DOT grants",
        "BEAD broadband",
        "EV charging",
        "bridge replacement funding",
        "IIJA implementation",
        "Medicare reimbursement",
        "340B drug pricing",
        "hospital workforce shortage",
        "telehealth permanence",
        "surprise billing",
      ],
      relevantAgencies: ["VA", "DOD", "HHS", "DOT", "DOE", "Commerce", "NTIA", "CMS", "FDA"],
      relevantCommittees: [
        "Senate Veterans Affairs",
        "House Veterans Affairs",
        "Senate Armed Services",
        "Senate EPW",
        "House Transportation and Infrastructure",
        "Senate Commerce",
        "Senate Finance",
        "House Ways and Means",
        "Senate HELP",
      ],
      notes: "Adam Consulting Group — primary platform account. Composite profile spanning all three demo client areas.",
    },
    {
      clientId: veteransId,
      industries: ["veterans services", "healthcare", "mental health"],
      watchlistTopics: [
        "veterans benefits expansion",
        "VA mental health funding",
        "GI Bill",
        "community care",
        "suicide prevention",
      ],
      relevantAgencies: ["VA", "DOD", "HHS"],
      relevantCommittees: [
        "Senate Veterans Affairs",
        "House Veterans Affairs",
        "Senate Armed Services",
      ],
      notes: null,
    },
    {
      clientId: infrastructureId,
      industries: ["infrastructure", "transportation", "energy"],
      watchlistTopics: [
        "DOT grants",
        "BEAD broadband",
        "EV charging",
        "bridge replacement funding",
        "IIJA implementation",
      ],
      relevantAgencies: ["DOT", "DOE", "Commerce", "NTIA"],
      relevantCommittees: [
        "Senate EPW",
        "House Transportation and Infrastructure",
        "Senate Commerce",
      ],
      notes: null,
    },
    {
      clientId: healthcareId,
      industries: ["healthcare", "hospitals", "Medicare", "Medicaid"],
      watchlistTopics: [
        "Medicare reimbursement",
        "340B drug pricing",
        "hospital workforce shortage",
        "telehealth permanence",
        "surprise billing",
      ],
      relevantAgencies: ["HHS", "CMS", "FDA"],
      relevantCommittees: ["Senate Finance", "House Ways and Means", "Senate HELP"],
      notes: null,
    },
  ];

  for (const profile of profiles) {
    await db
      .insert(clientProfiles)
      .values(profile)
      .onConflictDoNothing();
    console.log(`  Profile inserted/skipped for clientId: ${profile.clientId}`);
  }

  console.log("\nDone. Run the verification SQL in Supabase Dashboard:\n");
  console.log(
    "SELECT c.name, cp.industries, cp.watchlist_topics\nFROM client_profiles cp\nJOIN clients c ON cp.client_id = c.id;"
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
