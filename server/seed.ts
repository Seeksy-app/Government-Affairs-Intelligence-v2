import { db } from "./db";
import {
  clients,
  clientUsers,
  superAdmins,
  contacts,
  careerHistory,
  newsArticles,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  console.log("Checking if database needs seeding...");

  // Check if we already have data
  const existingClients = await db.select().from(clients);
  if (existingClients.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database with sample data...");

  // Create Adam's client firm
  const [adamClient] = await db
    .insert(clients)
    .values({
      name: "Adam Consulting Group",
      slug: "adam-consulting",
      industry: "Government Affairs",
      isActive: true,
    })
    .returning();

  // Create additional sample clients
  const [acmeLobby] = await db
    .insert(clients)
    .values({
      name: "Acme Lobbying Partners",
      slug: "acme-lobbying",
      industry: "Federal Lobbying",
      isActive: true,
    })
    .returning();

  const [capitalStrategy] = await db
    .insert(clients)
    .values({
      name: "Capital Strategy Group",
      slug: "capital-strategy",
      industry: "Political Consulting",
      isActive: true,
    })
    .returning();

  const [dcAdvocates] = await db
    .insert(clients)
    .values({
      name: "DC Advocates LLC",
      slug: "dc-advocates",
      industry: "Public Affairs",
      isActive: false,
    })
    .returning();

  console.log("Created sample clients");

  // Create sample contacts for Adam's client
  const sampleContacts = [
    {
      clientId: adamClient.id,
      firstName: "Sarah",
      lastName: "Mitchell",
      title: "Chief of Staff",
      organization: "Office of Senator Johnson",
      email: "sarah.mitchell@senate.gov",
      phone: "(202) 555-0142",
      party: "D",
      state: "VA",
      chamber: "Senate",
      priority: 5,
      notes: "Key contact for healthcare legislation. Met at policy forum in 2023.",
    },
    {
      clientId: adamClient.id,
      firstName: "Michael",
      lastName: "Thompson",
      title: "Legislative Director",
      organization: "House Committee on Energy",
      email: "michael.thompson@house.gov",
      phone: "(202) 555-0198",
      party: "R",
      state: "TX",
      chamber: "House",
      priority: 4,
      notes: "Focus on energy policy. Previously worked at DOE.",
    },
    {
      clientId: adamClient.id,
      firstName: "Jennifer",
      lastName: "Chen",
      title: "Deputy Assistant Secretary",
      organization: "Department of Commerce",
      email: "jennifer.chen@commerce.gov",
      phone: "(202) 555-0256",
      party: "N/A",
      state: "DC",
      chamber: "Administration",
      priority: 4,
      notes: "Trade policy expert. Strong connections to USTR.",
    },
    {
      clientId: adamClient.id,
      firstName: "Robert",
      lastName: "Williams",
      title: "Senior Policy Advisor",
      organization: "House Ways and Means Committee",
      email: "robert.williams@house.gov",
      phone: "(202) 555-0321",
      party: "D",
      state: "CA",
      chamber: "House",
      priority: 3,
      notes: "Tax policy specialist. Good rapport with committee chair.",
    },
    {
      clientId: adamClient.id,
      firstName: "Amanda",
      lastName: "Rodriguez",
      title: "Government Affairs Director",
      organization: "Tech Industry Association",
      email: "arodriguez@techassoc.org",
      phone: "(202) 555-0444",
      party: "N/A",
      state: "DC",
      chamber: "Lobbyist",
      priority: 3,
      notes: "Coalition partner on tech regulation issues.",
    },
  ];

  const insertedContacts = await db.insert(contacts).values(sampleContacts).returning();
  console.log(`Created ${insertedContacts.length} sample contacts`);

  // Add career history for some contacts
  const careerHistoryData = [
    // Sarah Mitchell's career
    {
      contactId: insertedContacts[0].id,
      title: "Chief of Staff",
      organization: "Office of Senator Johnson",
      startYear: 2021,
      endYear: null,
      description: "Manages all office operations and legislative priorities",
    },
    {
      contactId: insertedContacts[0].id,
      title: "Legislative Director",
      organization: "Office of Senator Johnson",
      startYear: 2017,
      endYear: 2021,
      description: "Led healthcare and education policy portfolios",
    },
    {
      contactId: insertedContacts[0].id,
      title: "Senior Policy Advisor",
      organization: "Senate HELP Committee",
      startYear: 2014,
      endYear: 2017,
      description: "Healthcare policy development",
    },
    // Michael Thompson's career
    {
      contactId: insertedContacts[1].id,
      title: "Legislative Director",
      organization: "House Committee on Energy",
      startYear: 2020,
      endYear: null,
      description: "Oversees all committee legislation",
    },
    {
      contactId: insertedContacts[1].id,
      title: "Policy Analyst",
      organization: "Department of Energy",
      startYear: 2015,
      endYear: 2020,
      description: "Renewable energy policy analysis",
    },
    // Jennifer Chen's career
    {
      contactId: insertedContacts[2].id,
      title: "Deputy Assistant Secretary",
      organization: "Department of Commerce",
      startYear: 2022,
      endYear: null,
      description: "International trade policy",
    },
    {
      contactId: insertedContacts[2].id,
      title: "Trade Policy Advisor",
      organization: "USTR",
      startYear: 2018,
      endYear: 2022,
      description: "Trade agreement negotiations",
    },
  ];

  await db.insert(careerHistory).values(careerHistoryData);
  console.log("Created career history entries");

  // Create sample news articles
  const sampleNews = [
    {
      clientId: adamClient.id,
      title: "Senate Committee Advances Infrastructure Bill",
      summary: "The Senate Environment and Public Works Committee voted 18-2 to advance a comprehensive infrastructure package worth $120 billion, focusing on highway and bridge improvements.",
      source: "Politico",
      url: "https://example.com/news/infrastructure-bill",
      category: "Legislation",
      isRead: false,
      isFlagged: true,
      publishedAt: new Date("2026-01-30"),
    },
    {
      clientId: adamClient.id,
      title: "White House Announces New Tech Regulation Framework",
      summary: "The administration unveiled a new framework for regulating AI and emerging technologies, emphasizing innovation-friendly approaches while maintaining consumer protections.",
      source: "The Hill",
      url: "https://example.com/news/tech-regulation",
      category: "Executive",
      isRead: false,
      isFlagged: false,
      publishedAt: new Date("2026-01-29"),
    },
    {
      clientId: adamClient.id,
      title: "House Energy Committee Schedules Hearing on Grid Modernization",
      summary: "Chairman announces upcoming hearing to examine electric grid modernization needs and funding priorities for the upcoming fiscal year.",
      source: "E&E News",
      url: "https://example.com/news/grid-hearing",
      category: "Legislation",
      isRead: true,
      isFlagged: false,
      publishedAt: new Date("2026-01-28"),
    },
    {
      clientId: adamClient.id,
      title: "Trade Representative Confirms New Tariff Review Process",
      summary: "USTR announces a streamlined process for businesses to request tariff exclusions, responding to industry concerns about supply chain costs.",
      source: "Reuters",
      url: "https://example.com/news/tariff-review",
      category: "Policy",
      isRead: false,
      isFlagged: true,
      publishedAt: new Date("2026-01-27"),
    },
    {
      clientId: adamClient.id,
      title: "Key Appropriations Subcommittee Chair Announces Retirement",
      summary: "Rep. Harrison (R-OH) announces retirement, creating significant implications for defense and homeland security funding priorities.",
      source: "Roll Call",
      url: "https://example.com/news/retirement",
      category: "Campaign",
      isRead: false,
      isFlagged: false,
      publishedAt: new Date("2026-01-26"),
    },
  ];

  await db.insert(newsArticles).values(sampleNews);
  console.log("Created sample news articles");

  console.log("Database seeding complete!");
}
