import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Database, Globe, Bot, Radio, Building2, Users, BarChart3, Mail, Search } from "lucide-react";

interface DataSource {
  name: string;
  category: "government" | "media" | "research" | "data" | "internal";
  description: string;
  url?: string;
  apiRequired?: boolean;
  status: "active" | "configured" | "available";
}

const DATA_SOURCES: DataSource[] = [
  {
    name: "Congress.gov API",
    category: "government",
    description: "Official source for congressional bills, resolutions, and legislative actions. Covers the 119th Congress (2025-2026) and historical data.",
    url: "https://api.congress.gov",
    apiRequired: true,
    status: "configured",
  },
  {
    name: "House Telephone Directory",
    category: "government",
    description: "Official House of Representatives staff directory (directory.house.gov). Scraped for 9,400+ employee records with office and position data.",
    url: "https://directory.house.gov",
    status: "active",
  },
  {
    name: "C-SPAN Video Library",
    category: "government",
    description: "Complete archive of congressional proceedings, hearings, and political events with searchable transcripts.",
    url: "https://www.c-span.org/video/",
    status: "available",
  },
  {
    name: "Senate Video/Audio",
    category: "government",
    description: "Official Senate hearing recordings and floor proceedings.",
    url: "https://www.senate.gov/committees/video-audio.htm",
    status: "available",
  },
  {
    name: "House Office of the Clerk",
    category: "government",
    description: "Official House hearing videos and legislative proceedings.",
    url: "https://clerk.house.gov/",
    status: "available",
  },
  {
    name: "GPO govinfo",
    category: "government",
    description: "Government Publishing Office - Congressional Record, Federal Register, and official documents.",
    url: "https://www.govinfo.gov/",
    status: "available",
  },
  {
    name: "Federal Register",
    category: "government",
    description: "Daily journal of the U.S. Government containing rules, proposed rules, and public notices.",
    url: "https://www.federalregister.gov/",
    status: "available",
  },
  {
    name: "YouTube Transcripts",
    category: "media",
    description: "Extract transcripts from YouTube videos including hearings, speeches, and political content. Watch list tracks videos awaiting captions.",
    apiRequired: false,
    status: "active",
  },
  {
    name: "LegiStorm API",
    category: "data",
    description: "Congressional staff directory with 12,000+ staffer profiles including position histories, contact information, salary data, and member associations. Supports full and incremental sync.",
    url: "https://www.legistorm.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "People Data Labs (PDL)",
    category: "data",
    description: "Professional profile enrichment with career histories, skills, education, and company data. Powers contact enrichment, company search, and LinkedIn career mapping.",
    url: "https://www.peopledatalabs.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Influencers Club API",
    category: "data",
    description: "Social media influencer tracking across Instagram, YouTube, TikTok, Twitter, Twitch, and OnlyFans. Profile enrichment and post monitoring.",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Kalshi API",
    category: "data",
    description: "Prediction market data for political event forecasting. Provides real-time market prices, event contracts, and settlement data for political outcomes.",
    url: "https://kalshi.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "SearchAPI.io",
    category: "data",
    description: "Google Rank Tracking API for monitoring search result rankings. Supports device targeting (desktop/mobile/tablet) and location-specific tracking.",
    url: "https://www.searchapi.io",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Perplexity AI",
    category: "research",
    description: "AI-powered research using the Sonar model. Powers staffer career research, entity research, veteran status analysis, bill-mapping discovery, and marketing intelligence.",
    url: "https://www.perplexity.ai",
    apiRequired: true,
    status: "active",
  },
  {
    name: "OpenAI GPT-4",
    category: "research",
    description: "AI chat and research assistant for document analysis, Q&A, content generation, and structured data extraction. Integrated via Replit AI.",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Firecrawl",
    category: "research",
    description: "AI-powered web content extraction and scraping. Used for research documents, news articles, team websites, and structured data extraction from URLs. SOC 2 Type II certified.",
    url: "https://www.firecrawl.dev",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Resend",
    category: "research",
    description: "Transactional email delivery for account notifications, daily briefs, research updates, and admin alerts.",
    url: "https://resend.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Contact Database",
    category: "internal",
    description: "Internal database of political contacts, career histories, and professional connections.",
    status: "active",
  },
  {
    name: "Research Documents",
    category: "internal",
    description: "Uploaded PDFs, extracted web content, and YouTube transcripts organized by matter.",
    status: "active",
  },
  {
    name: "News Aggregation",
    category: "internal",
    description: "Curated political news articles with filtering and tracking capabilities.",
    status: "active",
  },
  {
    name: "Social Media Tracker",
    category: "internal",
    description: "X/Twitter account monitoring with keyword matching, alerts, and engagement metrics.",
    status: "active",
  },
];

const categoryIcons = {
  government: Building2,
  media: Radio,
  research: Bot,
  data: Search,
  internal: Database,
};

const categoryLabels = {
  government: "Government",
  media: "Media",
  research: "AI & Research",
  data: "Data & Enrichment",
  internal: "Internal",
};

const categoryDescriptions = {
  government: "Official government data and legislative sources",
  media: "Video, audio, and media content sources",
  research: "AI-powered research, analysis, and communication tools",
  data: "Third-party APIs for data enrichment, directories, and market intelligence",
  internal: "Platform data and user-generated content",
};

const categoryColors = {
  government: "text-blue-500",
  media: "text-purple-500",
  research: "text-green-500",
  data: "text-amber-500",
  internal: "text-orange-500",
};

export default function SourcesPage() {
  const groupedSources = DATA_SOURCES.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, DataSource[]>);

  const categories = ["government", "data", "research", "media", "internal"] as const;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-sources-title">Data Sources</h1>
        <p className="text-muted-foreground mt-1">
          Master list of all data sources and APIs powering the platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {categories.map((category) => {
          const Icon = categoryIcons[category];
          return (
            <Card key={category}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${categoryColors[category]}`} />
                  <div>
                    <p className="text-2xl font-bold">{DATA_SOURCES.filter(s => s.category === category).length}</p>
                    <p className="text-sm text-muted-foreground">{categoryLabels[category]}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categories.map((category) => {
        const Icon = categoryIcons[category];
        const sources = groupedSources[category] || [];
        
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="w-5 h-5" />
                {categoryLabels[category]}
              </CardTitle>
              <CardDescription>
                {categoryDescriptions[category]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sources.map((source) => (
                  <div
                    key={source.name}
                    className="flex items-start justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`source-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{source.name}</p>
                        <Badge
                          variant={source.status === "active" ? "default" : source.status === "configured" ? "secondary" : "outline"}
                        >
                          {source.status}
                        </Badge>
                        {source.apiRequired && (
                          <Badge variant="outline" className="text-xs">
                            API Key Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{source.description}</p>
                    </div>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground ml-4"
                        data-testid={`link-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
