import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Database, Globe, Bot, Radio, Building2, Users, BarChart3, Mail, Search } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";

interface DataSource {
  name: string;
  category: "government" | "media" | "research" | "data" | "internal";
  description: string;
  url?: string;
  apiRequired?: boolean;
  status: "active" | "configured" | "available";
}

// Client-facing inventory of what powers the platform. Keep it accurate:
// firms read this page during security and procurement review.
const DATA_SOURCES: DataSource[] = [
  // Government
  {
    name: "Congress.gov",
    category: "government",
    description: "Official record of federal bills, resolutions, sponsors, actions, and Congressional Research Service summaries.",
    url: "https://api.congress.gov",
    apiRequired: true,
    status: "active",
  },
  {
    name: "LegiScan",
    category: "government",
    description: "Bill status and actions for all 50 state legislatures. Licensed under CC BY 4.0.",
    url: "https://legiscan.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Federal agency press releases",
    category: "government",
    description: "Newsroom feeds from federal departments, checked throughout the day and ranked in the Morning Brief.",
    status: "active",
  },
  {
    name: "Federal Register",
    category: "government",
    description: "Daily journal of the U.S. Government: rules, proposed rules, and public notices.",
    url: "https://www.federalregister.gov/",
    status: "available",
  },
  {
    name: "GPO govinfo",
    category: "government",
    description: "Government Publishing Office: Congressional Record and official publications.",
    url: "https://www.govinfo.gov/",
    status: "available",
  },
  {
    name: "House staff directory",
    category: "government",
    description: "Official House of Representatives staff directory with office and position data.",
    url: "https://directory.house.gov",
    status: "active",
  },
  // Directories & market data
  {
    name: "LegiStorm",
    category: "data",
    description: "Congressional staff directory: 16,700+ current staffers with titles, offices, contact details, and position histories.",
    url: "https://www.legistorm.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "People Data Labs",
    category: "data",
    description: "Professional profile enrichment for contacts: career history, education, and organizations.",
    url: "https://www.peopledatalabs.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Kalshi",
    category: "data",
    description: "Regulated prediction-market odds on elections and policy outcomes, refreshed every minute.",
    url: "https://kalshi.com",
    apiRequired: true,
    status: "active",
  },
  // Research & analysis
  {
    name: "Anthropic Claude",
    category: "research",
    description: "Writes Decision Briefs and ranks the Morning Brief. Every claim in a brief is cited to a source you can open.",
    url: "https://www.anthropic.com",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Parallel",
    category: "research",
    description: "Finds and reads current reporting and official pages for \"Should I be worried?\" answers.",
    url: "https://parallel.ai",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Perplexity",
    category: "research",
    description: "Web research for staffer career background and entity lookups.",
    url: "https://www.perplexity.ai",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Firecrawl",
    category: "research",
    description: "Extracts clean text from web pages and documents you add to research projects. SOC 2 Type II certified.",
    url: "https://www.firecrawl.dev",
    apiRequired: true,
    status: "active",
  },
  // Hearings & media
  {
    name: "C-SPAN Video Library",
    category: "media",
    description: "Archive of congressional proceedings and hearings with searchable transcripts.",
    url: "https://www.c-span.org/video/",
    status: "available",
  },
  {
    name: "Senate video and audio",
    category: "media",
    description: "Official Senate committee hearing recordings and floor proceedings.",
    url: "https://www.senate.gov/committees/video-audio.htm",
    status: "available",
  },
  {
    name: "House Office of the Clerk",
    category: "media",
    description: "Official House hearing video and floor proceedings.",
    url: "https://clerk.house.gov/",
    status: "available",
  },
  {
    name: "Hearing transcripts",
    category: "media",
    description: "Transcripts pulled from published hearing and speech video for search and research projects.",
    status: "active",
  },
  // Your workspace
  {
    name: "Contacts",
    category: "internal",
    description: "Your firm's contacts, lists, and notes. Private to your workspace.",
    status: "active",
  },
  {
    name: "Research projects",
    category: "internal",
    description: "Documents, links, and briefs you organize by project. Private to your workspace.",
    status: "active",
  },
  {
    name: "News",
    category: "internal",
    description: "Policy news collected from national and trade outlets, scored for relevance to your clients.",
    status: "active",
  },
];

const categoryIcons = {
  government: Building2,
  media: Radio,
  research: Search,
  data: BarChart3,
  internal: Database,
};

const categoryLabels = {
  government: "Government",
  media: "Hearings & media",
  research: "Research & analysis",
  data: "Directories & markets",
  internal: "Your workspace",
};

const categoryDescriptions = {
  government: "Official federal and state legislative and agency sources",
  media: "Hearing and floor video, audio, and transcripts",
  research: "Services that find, read, and summarize sources, always with citations",
  data: "Licensed directories and market data",
  internal: "Data your team creates, private to your workspace",
};

const statusBadgeClass: Record<DataSource["status"], string> = {
  active: "border-transparent bg-primary/10 text-primary",
  configured: "border-transparent bg-secondary text-secondary-foreground",
  available: "text-muted-foreground",
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
    <PageShell width="default" className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title={<span data-testid="text-sources-title">Sources</span>}
        description="Every data source and service behind your bills, briefs and directory, in one list."
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map((category) => {
          const Icon = categoryIcons[category];
          return (
            <Card key={category}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" />
                  <p className="truncate text-sm">{categoryLabels[category]}</p>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {DATA_SOURCES.filter(s => s.category === category).length}
                </p>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {categoryLabels[category]}
              </CardTitle>
              <CardDescription>
                {categoryDescriptions[category]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sources.map((source) => (
                  <div
                    key={source.name}
                    className="flex items-start justify-between gap-4 rounded-lg border p-4"
                    data-testid={`source-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{source.name}</p>
                        <Badge variant="outline" className={`capitalize shadow-none ${statusBadgeClass[source.status]}`}>
                          {source.status}
                        </Badge>
                        {source.apiRequired && (
                          <Badge variant="outline" className="text-xs font-medium text-muted-foreground shadow-none">
                            API key
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
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={`Open ${source.name}`}
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
    </PageShell>
  );
}
