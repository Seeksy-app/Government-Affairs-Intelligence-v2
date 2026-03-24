import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Building2, Search, DollarSign, FileText, Zap, Loader2,
  ExternalLink, Calendar, MapPin, TrendingUp, AlertCircle, BookOpen
} from "lucide-react";

const US_STATES = [
  { value: "all", label: "All States" },
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
  { value: "DC", label: "Washington D.C." },
];

function formatCurrency(num: number | undefined | null): string {
  if (!num) return "N/A";
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function formatDate(d: string | undefined | null): string {
  if (!d) return "N/A";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

// ─────────────────────────────────────────────────────────────
// Section 1: Federal Grants Finder
// ─────────────────────────────────────────────────────────────
function GrantsFinder() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("broadband");
  const [state, setState] = useState("all");
  const [eligibility, setEligibility] = useState("all");

  const mutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ keyword });
      if (state && state !== "all") params.set("state", state);
      if (eligibility && eligibility !== "all") params.set("eligibility", eligibility);
      const res = await apiRequest("GET", `/api/local-gov/grants?${params}`);
      return res.json();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const grants: any[] = mutation.data?.grants || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Keyword (e.g. broadband, infrastructure, housing)"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="flex-1 min-w-[200px]"
          onKeyDown={e => e.key === "Enter" && mutation.mutate()}
        />
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={eligibility} onValueChange={setEligibility}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Eligibility filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            <SelectItem value="city">City/Municipal</SelectItem>
            <SelectItem value="county">County</SelectItem>
            <SelectItem value="state">State government</SelectItem>
            <SelectItem value="nonprofit">Nonprofits</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching…</> : <><Search className="w-4 h-4 mr-2" />Search Grants</>}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      )}

      {!mutation.isPending && grants.length === 0 && mutation.isSuccess && (
        <div className="text-center py-10 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>No grants found. Try a different keyword or remove filters.</p>
        </div>
      )}

      {grants.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {grants.map((g, i) => (
            <Card key={g.id || i} className="border hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-tight">{g.title || "Untitled Grant"}</CardTitle>
                  {g.status && (
                    <Badge variant={g.status === "posted" ? "default" : "secondary"} className="text-xs shrink-0">
                      {g.status}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{g.agency || "Federal Agency"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {g.description && <p className="text-muted-foreground text-xs line-clamp-2">{g.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {g.maxAward && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />Max: {formatCurrency(g.maxAward)}
                    </span>
                  )}
                  {g.deadline && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />Deadline: {formatDate(g.deadline)}
                    </span>
                  )}
                  {g.category && <Badge variant="outline" className="text-xs">{g.category}</Badge>}
                </div>
                {g.url && (
                  <a href={g.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    View on Grants.gov <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 2: Federal Spending by Locality
// ─────────────────────────────────────────────────────────────
function SpendingLookup() {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState("Denver");
  const [state, setState] = useState("CO");

  const mutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (recipient) params.set("recipient", recipient);
      if (state && state !== "all") params.set("state", state);
      const res = await apiRequest("GET", `/api/local-gov/spending?${params}`);
      return res.json();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const awards: any[] = mutation.data?.awards || [];
  const total = mutation.data?.total || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="City or county name (e.g. Denver, Harris County)"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          className="flex-1 min-w-[200px]"
          onKeyDown={e => e.key === "Enter" && mutation.mutate()}
        />
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.filter(s => s.value).map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</> : <><DollarSign className="w-4 h-4 mr-2" />Find Spending</>}
        </Button>
      </div>

      {mutation.isPending && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      )}

      {!mutation.isPending && awards.length === 0 && mutation.isSuccess && (
        <div className="text-center py-10 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>No federal spending found for this locality. Try broadening your search.</p>
        </div>
      )}

      {awards.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Showing {awards.length} awards {total > awards.length ? `(of ${total.toLocaleString()} total)` : ""}
          </p>
          {awards.map((a, i) => (
            <Card key={a.id || i} className="border">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{a.recipient || "Unknown recipient"}</p>
                    <p className="text-xs text-muted-foreground">{a.awardingAgency}{a.subAgency ? ` → ${a.subAgency}` : ""}</p>
                    {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-primary">{formatCurrency(a.amount)}</p>
                    {(a.city || a.state) && (
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <MapPin className="w-3 h-3" />{[a.city, a.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                    {a.startDate && <p className="text-xs text-muted-foreground">{formatDate(a.startDate)}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 3: State Bill Tracker
// ─────────────────────────────────────────────────────────────
function BillTracker() {
  const { toast } = useToast();
  const [state, setState] = useState("co");
  const [keyword, setKeyword] = useState("infrastructure");

  const mutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ state: state.toLowerCase(), keyword });
      const res = await apiRequest("GET", `/api/local-gov/bills?${params}`);
      return res.json();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const bills: any[] = mutation.data?.bills || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.filter(s => s.value).map(s => (
              <SelectItem key={s.value} value={s.value.toLowerCase()}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Topic or keyword (e.g. infrastructure, broadband, housing)"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="flex-1 min-w-[200px]"
          onKeyDown={e => e.key === "Enter" && mutation.mutate()}
        />
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</> : <><FileText className="w-4 h-4 mr-2" />Track Bills</>}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Powered by OpenStates API (unauthenticated — may have rate limits)
      </p>

      {mutation.isPending && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {!mutation.isPending && bills.length === 0 && mutation.isSuccess && (
        <div className="text-center py-10 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>No bills found. OpenStates may have rate-limited the request — try again shortly, or add an API key for higher limits.</p>
        </div>
      )}

      {bills.length > 0 && (
        <div className="space-y-3">
          {bills.map((b, i) => (
            <Card key={b.id || i} className="border">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs shrink-0">{b.identifier}</Badge>
                      <Badge variant="secondary" className="text-xs shrink-0">{b.jurisdiction || state.toUpperCase()}</Badge>
                    </div>
                    <p className="font-semibold text-sm">{b.title}</p>
                    {b.abstract && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.abstract}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {b.sponsor && <span>Sponsor: {b.sponsor}</span>}
                      {b.lastAction && <span>Last action: {formatDate(b.lastAction)}</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {b.status && (
                      <Badge variant={b.status?.toLowerCase().includes("pass") ? "default" : "outline"} className="text-xs">
                        {b.status?.slice(0, 40)}
                      </Badge>
                    )}
                    {b.url && (
                      <div className="mt-1">
                        <a href={b.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section 4: Gap Analysis (killer feature)
// ─────────────────────────────────────────────────────────────
function GapAnalysis() {
  const { toast } = useToast();
  const [industry, setIndustry] = useState("broadband");
  const [state, setState] = useState("CO");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/local-gov/gap-analysis", { industry, state });
      return res.json();
    },
    onError: (e: any) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });

  const result = mutation.data;

  return (
    <div className="space-y-4">
      <div className="bg-muted/40 border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">AI-Powered Gap Analysis</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Combines real federal spending data + open grants with Perplexity AI to identify unmet opportunities
          — which city councils are missing out on federal money, and where your clients could fill the gap.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Industry / sector (e.g. broadband, clean energy, housing)"
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="flex-1 min-w-[200px]"
          onKeyDown={e => e.key === "Enter" && mutation.mutate()}
        />
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select state" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.filter(s => s.value).map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !industry || !state}
          className="min-w-[160px]"
        >
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</>
            : <><TrendingUp className="w-4 h-4 mr-2" />Run Gap Analysis</>}
        </Button>
      </div>

      {mutation.isPending && (
        <Card className="border-primary/30">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Fetching federal spending data for {state}…</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Querying open grants from Grants.gov…</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Running AI gap analysis with Perplexity…</span>
            </div>
            <Skeleton className="h-48 mt-4" />
          </CardContent>
        </Card>
      )}

      {result && !mutation.isPending && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Gap Analysis: {result.industry} in {result.state}
              </CardTitle>
              <div className="flex gap-2">
                {result.dataUsed?.spending && <Badge variant="outline" className="text-xs">Spending data ✓</Badge>}
                {result.dataUsed?.grants && <Badge variant="outline" className="text-xs">Grants data ✓</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm leading-relaxed">
              {result.briefing.split('\n').map((line: string, i: number) => {
                const cleaned = line.trim();
                if (!cleaned) return null;
                // ## or ### headers
                if (cleaned.startsWith('### ') || cleaned.startsWith('## ')) {
                  const text = cleaned.replace(/^#{2,3}\s+/, '').replace(/\*\*/g, '');
                  return <h4 key={i} className="font-bold text-base mt-4 mb-1 text-foreground border-b pb-1">{text}</h4>;
                }
                // **bold** only lines (section headers)
                if (cleaned.startsWith('**') && cleaned.endsWith('**')) {
                  return <p key={i} className="font-bold text-sm mt-3 text-foreground">{cleaned.replace(/\*\*/g, '')}</p>;
                }
                // Bullet points
                if (cleaned.startsWith('- ') || cleaned.startsWith('* ')) {
                  const text = cleaned.slice(2).replace(/\*\*(.*?)\*\*/g, '$1');
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <p className="text-muted-foreground">{text}</p>
                    </div>
                  );
                }
                // Numbered lists
                if (/^\d+\.\s/.test(cleaned)) {
                  const [num, ...rest] = cleaned.split(/\.\s/);
                  const text = rest.join('. ').replace(/\*\*(.*?)\*\*/g, '$1');
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{num}</span>
                      <p className="text-muted-foreground">{text}</p>
                    </div>
                  );
                }
                // Regular paragraph — inline bold
                const parts = cleaned.split(/\*\*(.*?)\*\*/g);
                return (
                  <p key={i} className="text-muted-foreground">
                    {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-foreground font-semibold">{part}</strong> : part)}
                  </p>
                );
              }).filter(Boolean)}
            </div>
            {result.citations && result.citations.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {result.citations.map((c: string, i: number) => (
                    <a key={i} href={c} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      [{i + 1}] <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function LocalGovIntelligencePage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="local-gov-intelligence-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Local Government Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Find city councils missing federal grant opportunities and identify unmet funding gaps for your clients
          </p>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: "Federal grants tracked", value: "Grants.gov live" },
          { icon: TrendingUp, label: "Spending data", value: "USASpending.gov" },
          { icon: FileText, label: "State bills", value: "OpenStates API" },
          { icon: Zap, label: "AI gap analysis", value: "Perplexity Sonar" },
        ].map((stat) => (
          <Card key={stat.label} className="border">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
                <p className="text-xs font-semibold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="gap-analysis" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="grants" className="text-xs">
            <Search className="w-3 h-3 mr-1" />Grants Finder
          </TabsTrigger>
          <TabsTrigger value="spending" className="text-xs">
            <DollarSign className="w-3 h-3 mr-1" />Fed Spending
          </TabsTrigger>
          <TabsTrigger value="bills" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />Bill Tracker
          </TabsTrigger>
          <TabsTrigger value="gap-analysis" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />Gap Analysis ⭐
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grants">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="w-4 h-4" />Federal Grants Finder
              </CardTitle>
              <CardDescription>
                Search currently open federal grants from Grants.gov — filter by keyword, state, and eligible entity type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GrantsFinder />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spending">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />Federal Spending by Locality
              </CardTitle>
              <CardDescription>
                See recent federal awards flowing to specific cities, counties, or state agencies via USASpending.gov
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SpendingLookup />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bills">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />State Bill Tracker
              </CardTitle>
              <CardDescription>
                Track state legislative activity by topic across all 50 states via OpenStates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BillTracker />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gap-analysis">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />Strategic Gap Analysis
              </CardTitle>
              <CardDescription>
                AI-powered briefing: cross-reference federal spending + open grants to find unmet opportunities for your clients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GapAnalysis />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
