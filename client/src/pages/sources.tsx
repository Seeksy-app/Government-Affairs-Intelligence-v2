import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Database, Globe, Youtube, FileText, Bot, Radio, Building2, Newspaper } from "lucide-react";

interface DataSource {
  name: string;
  category: "government" | "media" | "research" | "internal";
  description: string;
  url?: string;
  apiRequired?: boolean;
  status: "active" | "configured" | "available";
}

const DATA_SOURCES: DataSource[] = [
  // Government Sources
  {
    name: "Congress.gov API",
    category: "government",
    description: "Official source for congressional bills, resolutions, and legislative actions. Covers the 119th Congress (2025-2026) and historical data.",
    url: "https://api.congress.gov",
    apiRequired: true,
    status: "configured",
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
  // Media Sources
  {
    name: "YouTube Transcripts",
    category: "media",
    description: "Extract transcripts from YouTube videos including hearings, speeches, and political content. Watch list tracks videos awaiting captions.",
    apiRequired: false,
    status: "active",
  },
  {
    name: "Firecrawl Web Scraping",
    category: "research",
    description: "AI-powered web content extraction for research documents, news articles, and online sources.",
    apiRequired: true,
    status: "configured",
  },
  // Research Sources
  {
    name: "OpenAI GPT-4",
    category: "research",
    description: "AI-powered research assistant for analyzing documents, answering questions, and generating insights.",
    apiRequired: true,
    status: "active",
  },
  {
    name: "Entity Research Agent",
    category: "research",
    description: "Automated research on people, organizations, and companies using web search and AI analysis.",
    apiRequired: true,
    status: "active",
  },
  // Internal Sources
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
];

const categoryIcons = {
  government: Building2,
  media: Radio,
  research: Bot,
  internal: Database,
};

const categoryLabels = {
  government: "Government",
  media: "Media",
  research: "AI & Research",
  internal: "Internal",
};

export default function SourcesPage() {
  const groupedSources = DATA_SOURCES.reduce((acc, source) => {
    if (!acc[source.category]) {
      acc[source.category] = [];
    }
    acc[source.category].push(source);
    return acc;
  }, {} as Record<string, DataSource[]>);

  const categories = ["government", "media", "research", "internal"] as const;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Sources</h1>
        <p className="text-muted-foreground mt-1">
          Master list of all data sources powering the platform
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{DATA_SOURCES.filter(s => s.category === "government").length}</p>
                <p className="text-sm text-muted-foreground">Government Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{DATA_SOURCES.filter(s => s.category === "media").length}</p>
                <p className="text-sm text-muted-foreground">Media Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{DATA_SOURCES.filter(s => s.category === "research").length}</p>
                <p className="text-sm text-muted-foreground">AI & Research</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{DATA_SOURCES.filter(s => s.category === "internal").length}</p>
                <p className="text-sm text-muted-foreground">Internal Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                {category === "government" && "Official government data and legislative sources"}
                {category === "media" && "Video, audio, and media content sources"}
                {category === "research" && "AI-powered research and analysis tools"}
                {category === "internal" && "Platform data and user-generated content"}
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
