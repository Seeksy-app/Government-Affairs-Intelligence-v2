import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { Link } from "wouter";

interface KBTooltipProps {
  articleSlug?: string;
  content: string;
  children?: React.ReactNode;
}

export function KBTooltip({ articleSlug, content, children }: KBTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children || (
          <button 
            className="inline-flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="tooltip-help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
        {articleSlug && (
          <Link 
            href={`/kb?article=${articleSlug}`} 
            className="text-xs text-primary hover:underline mt-1 block"
            data-testid="tooltip-learn-more"
          >
            Learn more
          </Link>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface FeatureTooltipProps {
  feature: 
    | "contacts" 
    | "matters" 
    | "portals" 
    | "research" 
    | "network"
    | "security"
    | "ai-agent"
    | "documents";
  children?: React.ReactNode;
}

const featureHelp: Record<string, { content: string; slug?: string }> = {
  contacts: {
    content: "Track political contacts, their career history, and relationships",
    slug: "contacts-guide",
  },
  matters: {
    content: "Organize research into matters (sub-clients) for targeted investigations",
    slug: "matters-guide",
  },
  portals: {
    content: "Share research with your clients through custom portals",
    slug: "portals-guide",
  },
  research: {
    content: "Add web URLs, YouTube videos, and documents for AI analysis",
    slug: "research-guide",
  },
  network: {
    content: "Visualize relationships between contacts and organizations",
    slug: "network-guide",
  },
  security: {
    content: "View your organization's security status and data protection measures",
    slug: "security-guide",
  },
  "ai-agent": {
    content: "Ask questions about your research documents using AI",
    slug: "ai-agent-guide",
  },
  documents: {
    content: "Upload PDFs, extract web content, and process YouTube transcripts",
    slug: "documents-guide",
  },
};

export function FeatureTooltip({ feature, children }: FeatureTooltipProps) {
  const help = featureHelp[feature];
  if (!help) return <>{children}</>;
  
  return (
    <KBTooltip content={help.content} articleSlug={help.slug}>
      {children}
    </KBTooltip>
  );
}
