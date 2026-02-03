import { db } from "./db";
import {
  clients,
  clientUsers,
  superAdmins,
  contacts,
  careerHistory,
  newsArticles,
  staffers,
  stafferCareerPositions,
  stafferConnections,
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

  // Seed Mike Johnson's staffers
  const johnsonStaffers = [
    {
      clientId: adamClient.id,
      name: "Hayden Haynes",
      currentPosition: "Chief of Staff",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Leadership Operations",
      pathwayType: "Johnson Loyalist",
      yearsInCurrentRole: 2,
      education: ["Louisiana Tech (BA)", "Gonzaga (MA)"],
      bio: "Long-time aide to Mike Johnson, serving since his first congressional campaign. Expert in legislative operations and congressional procedure.",
    },
    {
      clientId: adamClient.id,
      name: "Raj Shah",
      currentPosition: "Deputy COS Communications",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Media Strategy",
      pathwayType: "Trump World",
      yearsInCurrentRole: 2,
      education: ["Georgetown University"],
      bio: "Former White House Deputy Press Secretary. Expert in strategic communications and crisis management.",
    },
    {
      clientId: adamClient.id,
      name: "Garrett Fultz",
      currentPosition: "Deputy Chief of Staff",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Legislative Policy",
      pathwayType: "Johnson Loyalist",
      yearsInCurrentRole: 2,
      education: ["Ole Miss", "Tulane Law"],
      bio: "Policy expert with extensive background in constitutional law and legislative affairs.",
    },
    {
      clientId: adamClient.id,
      name: "Mark Epley",
      currentPosition: "Floor Director",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Floor Operations",
      pathwayType: "Hill Veteran",
      yearsInCurrentRole: 2,
      education: ["University of Virginia"],
      bio: "Experienced floor strategist with deep knowledge of House procedures and vote counting.",
    },
    {
      clientId: adamClient.id,
      name: "Dan Ziegler",
      currentPosition: "Policy Director",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Economic Policy",
      pathwayType: "Think Tank",
      yearsInCurrentRole: 1,
      education: ["Harvard University", "Stanford MBA"],
      bio: "Former Heritage Foundation fellow specializing in fiscal policy and budget matters.",
    },
    {
      clientId: adamClient.id,
      name: "Jessica Moore",
      currentPosition: "Communications Director",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Communications",
      pathwayType: "Campaign Veteran",
      yearsInCurrentRole: 2,
      education: ["LSU (BA)"],
      bio: "Experienced communications professional with background in campaign messaging and media relations.",
    },
    {
      clientId: adamClient.id,
      name: "Tyler Becker",
      currentPosition: "Scheduler",
      currentOrganization: "Office of the Speaker",
      currentMember: "Mike Johnson",
      chamber: "House",
      party: "Republican",
      state: "LA",
      specialty: "Scheduling",
      pathwayType: "Johnson Loyalist",
      yearsInCurrentRole: 3,
      education: ["Louisiana Tech"],
      bio: "Manages the Speaker's complex daily schedule and coordinates with leadership offices.",
    },
  ];

  const insertedStaffers = await db.insert(staffers).values(johnsonStaffers).returning();
  console.log("Created Johnson staffers");

  // Add career positions for Hayden Haynes
  const haydenId = insertedStaffers[0].id;
  const haydenPositions = [
    {
      stafferId: haydenId,
      position: "Chief of Staff",
      organization: "Office of the Speaker",
      bossName: "Mike Johnson",
      startYear: 2023,
      endYear: null,
      isCurrent: true,
      orgType: "Congressional Office",
      chamber: "House",
      state: "LA",
    },
    {
      stafferId: haydenId,
      position: "Chief of Staff",
      organization: "Rep. Mike Johnson Office",
      bossName: "Mike Johnson",
      startYear: 2017,
      endYear: 2023,
      isCurrent: false,
      orgType: "Congressional Office",
      chamber: "House",
      state: "LA",
    },
    {
      stafferId: haydenId,
      position: "Campaign Manager",
      organization: "Mike Johnson for Congress",
      bossName: "Mike Johnson",
      startYear: 2016,
      endYear: 2016,
      isCurrent: false,
      orgType: "Campaign",
      chamber: "House",
      state: "LA",
    },
    {
      stafferId: haydenId,
      position: "Regional Representative",
      organization: "Sen. David Vitter Office",
      bossName: "David Vitter",
      startYear: 2013,
      endYear: 2016,
      isCurrent: false,
      orgType: "Congressional Office",
      chamber: "Senate",
      state: "LA",
    },
  ];

  await db.insert(stafferCareerPositions).values(haydenPositions);
  console.log("Created career positions for Hayden Haynes");

  // Add connections for Hayden Haynes
  const haydenConnections = [
    {
      stafferId: haydenId,
      connectedToName: "Mike Johnson",
      connectionType: "reported_to",
      organization: "Office of the Speaker",
      yearsTogether: 9,
      strength: "Strong",
      notes: "Primary staffer since Johnson's first campaign",
    },
    {
      stafferId: haydenId,
      connectedToName: "David Vitter",
      connectionType: "reported_to",
      organization: "Sen. Vitter Office",
      yearsTogether: 3,
      strength: "Medium",
      notes: "Worked as regional representative",
    },
    {
      stafferId: haydenId,
      connectedToName: "Garrett Fultz",
      connectionType: "colleague",
      organization: "Office of the Speaker",
      yearsTogether: 7,
      strength: "Strong",
      notes: "Long-time colleague in Johnson's office",
    },
  ];

  await db.insert(stafferConnections).values(haydenConnections);
  console.log("Created connections for Hayden Haynes");

  // Add career positions for Raj Shah
  const rajId = insertedStaffers[1].id;
  const rajPositions = [
    {
      stafferId: rajId,
      position: "Deputy COS Communications",
      organization: "Office of the Speaker",
      bossName: "Mike Johnson",
      startYear: 2023,
      endYear: null,
      isCurrent: true,
      orgType: "Congressional Office",
      chamber: "House",
      state: "LA",
    },
    {
      stafferId: rajId,
      position: "Deputy Press Secretary",
      organization: "White House",
      bossName: "Sarah Sanders",
      startYear: 2017,
      endYear: 2019,
      isCurrent: false,
      orgType: "White House",
      chamber: null,
      state: null,
    },
    {
      stafferId: rajId,
      position: "Research Director",
      organization: "Republican National Committee",
      bossName: null,
      startYear: 2015,
      endYear: 2017,
      isCurrent: false,
      orgType: "Campaign",
      chamber: null,
      state: null,
    },
  ];

  await db.insert(stafferCareerPositions).values(rajPositions);
  console.log("Created career positions for Raj Shah");

  console.log("Database seeding complete!");
}
