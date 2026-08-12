import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  User, 
  Network, 
  FileText, 
  ExternalLink, 
  Search, 
  Bookmark,
  Calendar,
  Building2,
  Users,
  MapPin,
  Briefcase,
  ArrowRight,
  Info
} from "lucide-react";

interface ParsedStaffer {
  name: string;
  position: string;
  organization: string;
  specialty?: string;
  syncedAt?: string;
}

// Real directory rows returned by the backend's search_staffer_directory tool.
export interface DirectoryStaffer {
  id: string;
  fullName: string;
  title: string | null;
  office: string | null;
  memberName: string | null;
  chamber: string | null;
  state: string | null;
  email: string | null;
  isCurrentStaff: boolean | null;
  lastUpdatedFromApi: string | null;
}

interface ParsedArticle {
  title: string;
  url?: string;
  source: string;
  publishedDate?: string;
  excerpt?: string;
}

interface ParsedBill {
  billNumber: string;
  title: string;
  status?: string;
  impactLevel?: string;
}

interface ParsedEntities {
  staffers: ParsedStaffer[];
  articles: ParsedArticle[];
  bills: ParsedBill[];
}

interface QuickAction {
  type: string;
  label: string;
  icon: string;
}

interface AIMessageRendererProps {
  content: string;
  onFollowUp?: (query: string) => void;
  staffers?: DirectoryStaffer[];
}

// Convert real directory rows into card-renderable entries. Staffer cards are
// ONLY built from database rows the backend returned — the old regex that
// guessed staffer names out of bolded prose produced garbage cards
// ("outdated or incomplete", "LegiStorm") and is gone.
function stafferEntitiesFromDirectory(rows: DirectoryStaffer[] | undefined): ParsedStaffer[] {
  if (!rows || rows.length === 0) return [];
  return rows.map((r) => ({
    name: r.fullName,
    position: r.title || "Staffer",
    organization: r.memberName
      ? `Office of ${r.memberName}`
      : r.office || "Congressional Staff",
    specialty: r.chamber ? `${r.chamber}${r.state ? ` · ${r.state}` : ""}` : undefined,
    syncedAt: r.lastUpdatedFromApi ?? undefined,
  }));
}

function parseEntities(content: string): ParsedEntities {
  const staffers: ParsedStaffer[] = [];
  const articles: ParsedArticle[] = [];
  const bills: ParsedBill[] = [];

  const billPattern = /(H\.R\.\s*\d+|S\.\s*\d+|H\.Res\.\s*\d+|S\.Res\.\s*\d+)/gi;
  const billMatches = Array.from(content.matchAll(billPattern));
  for (const bMatch of billMatches) {
    const billNumber = bMatch[1].replace(/\s+/g, ' ');
    if (!bills.some(b => b.billNumber === billNumber)) {
      bills.push({
        billNumber,
        title: "Legislation",
        status: "Active"
      });
    }
  }
  
  const urlPattern = /https?:\/\/[^\s<>)\]]+/g;
  const urls = content.match(urlPattern) || [];
  for (const url of urls) {
    let source = "Web Source";
    if (url.includes('congress.gov')) source = "Congress.gov";
    else if (url.includes('nytimes')) source = "New York Times";
    else if (url.includes('washingtonpost')) source = "Washington Post";
    else if (url.includes('politico')) source = "Politico";
    else if (url.includes('thehill')) source = "The Hill";
    
    articles.push({
      title: "Source Article",
      url,
      source
    });
  }
  
  return { staffers, articles, bills };
}

function generateQuickActions(entities: ParsedEntities): QuickAction[] {
  const actions: QuickAction[] = [];
  
  if (entities.staffers.length > 0) {
    actions.push({
      type: "visualize_network",
      label: "Visualize Network",
      icon: "network"
    });
    actions.push({
      type: "generate_report",
      label: "Generate Report",
      icon: "file-text"
    });
  }
  
  if (entities.bills.length > 0) {
    actions.push({
      type: "track_bills",
      label: "Track Bills",
      icon: "bookmark"
    });
  }
  
  return actions;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function StafferCard({ staffer }: { staffer: ParsedStaffer }) {
  const [, setLocation] = useLocation();
  
  return (
    <Card className="hover-elevate transition-all" data-testid={`card-staffer-${staffer.name.replace(/\s+/g, '-').toLowerCase()}`}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Avatar className="h-12 w-12 bg-gradient-to-br from-primary/80 to-primary">
            <AvatarFallback className="bg-transparent text-primary-foreground font-semibold">
              {getInitials(staffer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{staffer.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{staffer.position}</p>
            <p className="text-xs text-muted-foreground/70 truncate flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {staffer.organization}
            </p>
            {staffer.specialty && (
              <Badge variant="secondary" className="mt-2 text-xs">{staffer.specialty}</Badge>
            )}
            {staffer.syncedAt && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Directory record · synced {new Date(staffer.syncedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Button 
            size="sm" 
            variant="default" 
            className="flex-1 text-xs h-8"
            onClick={() => setLocation(`/network?search=${encodeURIComponent(staffer.name)}`)}
            data-testid={`button-view-profile-${staffer.name.replace(/\s+/g, '-').toLowerCase()}`}
          >
            <User className="h-3 w-3 mr-1" />
            View Profile
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs h-8"
            onClick={() => setLocation(`/network?search=${encodeURIComponent(staffer.name)}`)}
            data-testid={`button-network-${staffer.name.replace(/\s+/g, '-').toLowerCase()}`}
          >
            <Network className="h-3 w-3 mr-1" />
            Network
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ArticleCard({ article }: { article: ParsedArticle }) {
  const sourceColors: Record<string, string> = {
    "Congress.gov": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    "Politico": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    "The Hill": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    "New York Times": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
    "Washington Post": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
    "Web Source": "bg-muted text-muted-foreground"
  };
  
  return (
    <Card className="hover-elevate transition-all" data-testid={`card-article-${article.source.replace(/\s+/g, '-').toLowerCase()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant="secondary" className={`text-xs ${sourceColors[article.source] || sourceColors["Web Source"]}`}>
            {article.source}
          </Badge>
          {article.publishedDate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {article.publishedDate}
            </span>
          )}
        </div>
        <h4 className="font-medium text-sm line-clamp-2 mb-2">{article.title}</h4>
        {article.excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{article.excerpt}</p>
        )}
        {article.url && (
          <Button 
            size="sm" 
            variant="outline" 
            className="w-full text-xs h-8"
            onClick={() => window.open(article.url, '_blank')}
            data-testid={`button-read-article-${article.source.replace(/\s+/g, '-').toLowerCase()}`}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Read Full Article
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function BillCard({ bill }: { bill: ParsedBill }) {
  const [, setLocation] = useLocation();
  
  const impactColors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
  };
  
  return (
    <Card className="hover-elevate transition-all" data-testid={`card-bill-${bill.billNumber.replace(/[.\s]+/g, '-').toLowerCase()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Badge variant="outline" className="font-mono text-xs">{bill.billNumber}</Badge>
          {bill.impactLevel && (
            <Badge variant="secondary" className={`text-xs uppercase ${impactColors[bill.impactLevel.toLowerCase()] || ""}`}>
              {bill.impactLevel}
            </Badge>
          )}
        </div>
        <h4 className="font-medium text-sm line-clamp-2 mb-2">{bill.title}</h4>
        {bill.status && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
            <Info className="h-3 w-3" />
            Status: {bill.status}
          </p>
        )}
        <Button 
          size="sm" 
          variant="default" 
          className="w-full text-xs h-8"
          onClick={() => window.open(`https://congress.gov/bill/search?q=${encodeURIComponent(bill.billNumber)}`, '_blank')}
          data-testid={`button-view-bill-${bill.billNumber.replace(/[.\s]+/g, '-').toLowerCase()}`}
        >
          <FileText className="h-3 w-3 mr-1" />
          View Bill Details
        </Button>
      </CardContent>
    </Card>
  );
}

function QuickActionsBar({ actions, entities, onFollowUp }: { 
  actions: QuickAction[]; 
  entities: ParsedEntities;
  onFollowUp?: (query: string) => void;
}) {
  const [, setLocation] = useLocation();
  
  if (actions.length === 0) return null;
  
  const handleAction = (action: QuickAction) => {
    switch (action.type) {
      case "visualize_network":
        if (entities.staffers.length > 0) {
          setLocation(`/network?search=${encodeURIComponent(entities.staffers[0].name)}`);
        }
        break;
      case "generate_report":
        if (onFollowUp) {
          onFollowUp(`Generate a detailed report on ${entities.staffers.map(s => s.name).join(', ')}`);
        }
        break;
      case "track_bills":
        if (entities.bills.length > 0) {
          window.open(`https://congress.gov/bill/search?q=${encodeURIComponent(entities.bills[0].billNumber)}`, '_blank');
        }
        break;
    }
  };
  
  const getIcon = (iconType: string) => {
    switch (iconType) {
      case "network": return <Network className="h-4 w-4" />;
      case "file-text": return <FileText className="h-4 w-4" />;
      case "bookmark": return <Bookmark className="h-4 w-4" />;
      default: return <ArrowRight className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mt-3" data-testid="quick-actions-bar">
      <p className="text-xs font-medium text-primary mb-2">Quick Actions:</p>
      <div className="flex gap-2 flex-wrap">
        {actions.map((action, i) => (
          <Button
            key={i}
            size="sm"
            variant="outline"
            className="text-xs h-8 border-primary/30 hover:bg-primary/10"
            onClick={() => handleAction(action)}
            data-testid={`button-quick-action-${action.type}`}
          >
            {getIcon(action.icon)}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function SuggestedFollowUps({ entities, onFollowUp }: { 
  entities: ParsedEntities; 
  onFollowUp?: (query: string) => void;
}) {
  if (!onFollowUp) return null;
  
  const suggestions: string[] = [];
  
  if (entities.staffers.length > 0) {
    suggestions.push(`Show me articles mentioning ${entities.staffers[0].name}`);
    if (entities.staffers.length > 1) {
      suggestions.push(`Find connections between these staffers`);
    }
    suggestions.push(`What is ${entities.staffers[0].name}'s career history?`);
  }
  
  if (entities.bills.length > 0) {
    suggestions.push(`Track the status of ${entities.bills[0].billNumber}`);
  }
  
  if (suggestions.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-border/50" data-testid="suggested-followups">
      <p className="text-xs text-muted-foreground mb-2">You might also want to:</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.slice(0, 3).map((suggestion, i) => (
          <Button
            key={i}
            size="sm"
            variant="ghost"
            className="text-xs h-auto py-1.5 px-2 text-muted-foreground hover:text-foreground whitespace-normal text-left justify-start"
            onClick={() => onFollowUp(suggestion)}
            data-testid={`button-followup-${i}`}
          >
            <ArrowRight className="h-3 w-3 mr-1 shrink-0" />
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}

function renderInlineContent(text: string, entities: ParsedEntities, keyPrefix: string = "") {
  const parts: JSX.Element[] = [];
  
  // Markdown links first so their URLs aren't split out by the bare-URL branch.
  const combinedPattern = /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|https?:\/\/[^\s<>)\]]+)/g;
  let lastIndex = 0;
  let match;
  let partIndex = 0;

  while ((match = combinedPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-text-${partIndex++}`}>{text.slice(lastIndex, match.index)}</span>);
    }

    const matchedText = match[0];

    const mdLink = matchedText.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (mdLink) {
      parts.push(
        <a
          key={`${keyPrefix}-mdlink-${partIndex++}`}
          href={mdLink[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
          data-testid={`link-md-${partIndex}`}
        >
          {mdLink[1]}
          <ExternalLink className="h-3 w-3 inline" />
        </a>
      );
    } else if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
      const innerText = matchedText.slice(2, -2);
      const matchingStaffer = entities.staffers.find(s => s.name === innerText);
      
      if (matchingStaffer) {
        parts.push(
          <Link
            key={`${keyPrefix}-link-${partIndex++}`}
            href={`/network?search=${encodeURIComponent(matchingStaffer.name)}`}
            className="font-semibold text-primary hover:underline cursor-pointer"
            data-testid={`link-staffer-${matchingStaffer.name.replace(/\s+/g, '-').toLowerCase()}`}
          >
            {matchingStaffer.name}
          </Link>
        );
      } else {
        parts.push(<strong key={`${keyPrefix}-bold-${partIndex++}`}>{innerText}</strong>);
      }
    } else if (matchedText.startsWith('http')) {
      let displayName = "Link";
      try {
        const url = new URL(matchedText);
        displayName = url.hostname.replace('www.', '');
      } catch { }
      
      parts.push(
        <a
          key={`${keyPrefix}-url-${partIndex++}`}
          href={matchedText}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
          data-testid={`link-url-${partIndex}`}
        >
          {displayName}
          <ExternalLink className="h-3 w-3 inline" />
        </a>
      );
    }
    
    lastIndex = match.index + matchedText.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-text-${partIndex++}`}>{text.slice(lastIndex)}</span>);
  }
  
  return parts.length > 0 ? parts : [<span key={`${keyPrefix}-empty`}>{text}</span>];
}

function EnhancedMarkdown({ content, entities }: { content: string; entities: ParsedEntities }) {
  const lines = content.split('\n');
  let inList = false;
  const elements: JSX.Element[] = [];
  let listItems: JSX.Element[] = [];
  
  const flushList = (i: number) => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`ul-flush-${i}`} className="list-disc list-inside my-2 space-y-1">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, i) => {
    const trimmedLine = line.trim();

    // Horizontal rules / stray divider lines (---, --, ***, "* --") → thin rule.
    // Without this, "-"-led divider lines render as bullet items reading "--".
    if (/^[*\s]*[-_*]{2,}[*\s]*$/.test(trimmedLine) && !/[a-zA-Z0-9]/.test(trimmedLine)) {
      flushList(i);
      elements.push(<hr key={`hr-${i}`} className="my-3 border-border/60" />);
      return;
    }

    // Markdown headings (#, ##, ###...) → styled heading line.
    const heading = trimmedLine.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      flushList(i);
      elements.push(
        <h4 key={`h-${i}`} className="font-semibold text-sm mt-3 mb-1.5">
          {renderInlineContent(heading[1], entities, `h-${i}`)}
        </h4>
      );
      return;
    }

    if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      const itemContent = trimmedLine.replace(/^[-•]\s*/, '');
      listItems.push(
        <li key={`li-${i}`} className="mb-1">
          {renderInlineContent(itemContent, entities, `li-${i}`)}
        </li>
      );
    } else {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`ul-${i}`} className="list-disc list-inside my-2 space-y-1">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
      
      if (trimmedLine.match(/^\d+\.\s/)) {
        const itemContent = trimmedLine.replace(/^\d+\.\s*/, '');
        elements.push(
          <p key={`num-${i}`} className="mb-2 font-medium">
            {renderInlineContent(trimmedLine.match(/^\d+\./)?.[0] + ' ', entities, `num-prefix-${i}`)}
            {renderInlineContent(itemContent, entities, `num-${i}`)}
          </p>
        );
      } else if (trimmedLine === '') {
        elements.push(<div key={`br-${i}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="mb-2 last:mb-0">
            {renderInlineContent(line, entities, `p-${i}`)}
          </p>
        );
      }
    }
  });
  
  if (inList && listItems.length > 0) {
    elements.push(
      <ul key="ul-final" className="list-disc list-inside my-2 space-y-1">
        {listItems}
      </ul>
    );
  }
  
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
      {elements}
    </div>
  );
}

export function AIMessageRenderer({ content, onFollowUp, staffers }: AIMessageRendererProps) {
  const entities = parseEntities(content);
  entities.staffers = stafferEntitiesFromDirectory(staffers);
  const quickActions = generateQuickActions(entities);
  
  const hasStructuredData = entities.staffers.length > 0 || entities.articles.length > 0 || entities.bills.length > 0;
  
  return (
    <div className="space-y-4" data-testid="ai-message-renderer">
      <EnhancedMarkdown content={content} entities={entities} />
      
      {entities.staffers.length > 0 && (
        <div className="mt-4" data-testid="staffers-section">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {entities.staffers.length} Staffer{entities.staffers.length > 1 ? 's' : ''} from your directory
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {entities.staffers.slice(0, 6).map((staffer, i) => (
              <StafferCard key={i} staffer={staffer} />
            ))}
          </div>
          {entities.staffers.length > 6 && (
            <p className="text-xs text-muted-foreground mt-2">
              And {entities.staffers.length - 6} more staffers...
            </p>
          )}
        </div>
      )}
      
      {entities.articles.length > 0 && (
        <div className="mt-4" data-testid="articles-section">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Found {entities.articles.length} Source{entities.articles.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {entities.articles.slice(0, 3).map((article, i) => (
              <ArticleCard key={i} article={article} />
            ))}
          </div>
        </div>
      )}
      
      {entities.bills.length > 0 && (
        <div className="mt-4" data-testid="bills-section">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Tracking {entities.bills.length} Bill{entities.bills.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {entities.bills.slice(0, 3).map((bill, i) => (
              <BillCard key={i} bill={bill} />
            ))}
          </div>
        </div>
      )}
      
      {hasStructuredData && (
        <>
          <QuickActionsBar actions={quickActions} entities={entities} onFollowUp={onFollowUp} />
          <SuggestedFollowUps entities={entities} onFollowUp={onFollowUp} />
        </>
      )}
    </div>
  );
}
