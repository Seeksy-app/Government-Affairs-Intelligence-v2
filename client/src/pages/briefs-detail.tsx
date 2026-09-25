import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft, Copy, Check, Lock, Share2, ExternalLink, RefreshCw,
  Edit3, Clock, CheckCircle, XCircle, FileText, Eye, Plus, Trash2, AlertCircle, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, PageShell } from "@/components/page-header";
import type { Brief, BriefSource, BriefContent } from "@shared/schema";
import { BottomLine } from "@/components/briefs/bottom-line";

// Matches the server's cutoff for treating an interrupted run as dead.
const STALE_GENERATING_MS = 5 * 60 * 1000;

type BriefWithSources = Brief & { sources: BriefSource[] };

// ─── Citation rendering ───────────────────────────────────────────────────────

function tierBadge(tier: number) {
  if (tier === 1) return <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ml-0.5">T1</span>;
  if (tier === 2) return <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-0.5">T2</span>;
  return <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-muted text-muted-foreground ml-0.5">T3</span>;
}

function CitedText({ text, sources }: { text: string; sources: BriefSource[] }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          const num = parseInt(match[1]);
          const source = sources.find((s) => s.citationNumber === num);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <a
                  href={`#source-${num}`}
                  className="text-primary font-semibold hover:underline text-xs align-super cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`source-${num}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  [{num}]
                </a>
              </TooltipTrigger>
              {source && (
                <TooltipContent side="top" className="max-w-xs">
                  <p className="font-medium text-xs">{source.title ?? source.url}</p>
                  {source.publication && (
                    <p className="text-muted-foreground text-xs">{source.publication}</p>
                  )}
                </TooltipContent>
              )}
            </Tooltip>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "ready")
    return <Badge className="border-transparent bg-emerald-50 text-emerald-700 shadow-none dark:bg-emerald-900/30 dark:text-emerald-300"><CheckCircle className="h-3 w-3 mr-1" />Ready</Badge>;
  if (status === "generating")
    return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</Badge>;
  if (status === "failed")
    return <Badge className="border-transparent bg-destructive/10 text-destructive shadow-none"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
  return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
}

// ─── Edit metadata dialog ─────────────────────────────────────────────────────

function EditDialog({
  brief,
  open,
  onOpenChange,
}: {
  brief: BriefWithSources;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(brief.title);
  const [clientContext, setClientContext] = useState(brief.clientContext ?? "");
  const [sensitivity, setSensitivity] = useState<"internal" | "shareable">(
    brief.sensitivity as "internal" | "shareable",
  );
  const [urls, setUrls] = useState<string[]>(
    brief.sources.length > 0 ? brief.sources.map((s) => s.url) : [""],
  );

  useEffect(() => {
    if (open) {
      setTitle(brief.title);
      setClientContext(brief.clientContext ?? "");
      setSensitivity(brief.sensitivity as "internal" | "shareable");
      setUrls(brief.sources.length > 0 ? brief.sources.map((s) => s.url) : [""]);
    }
  }, [open, brief]);

  const validUrls = urls.filter((u) => u.trim() !== "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/briefs/${brief.id}`, {
        title: title.trim(),
        clientContext: clientContext.trim() || null,
        sensitivity,
        sourceUrls: validUrls,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/briefs/${brief.id}`] });
      onOpenChange(false);
      toast({ title: "Brief updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addUrl = () => { if (urls.length < 5) setUrls([...urls, ""]); };
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) =>
    setUrls(urls.map((u, idx) => (idx === i ? val : u)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Brief</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} />
          </div>

          <div className="space-y-1.5">
            <Label>Sensitivity</Label>
            <div className="flex gap-2">
              {(["internal", "shareable"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSensitivity(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    sensitivity === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {s === "internal" ? <Lock className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-context">Client Context</Label>
            <Textarea
              id="edit-context"
              value={clientContext}
              onChange={(e) => setClientContext(e.target.value)}
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Source URLs</Label>
            <div className="space-y-2">
              {urls.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => updateUrl(i, e.target.value)}
                    className="flex-1"
                  />
                  {urls.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeUrl(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {urls.length < 5 && (
              <Button variant="outline" size="sm" onClick={addUrl}>
                <Plus className="h-4 w-4 mr-1" />Add URL
              </Button>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !title.trim() || validUrls.length === 0}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BriefDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: brief, isLoading } = useQuery<BriefWithSources>({
    queryKey: [`/api/briefs/${id}`],
    refetchInterval: (query) => {
      const data = query.state.data as BriefWithSources | undefined;
      return data?.status === "generating" ? 3000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/briefs/${id}/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/briefs/${id}`] });
      toast({ title: "Generation started — this may take a minute" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't start the brief", description: err.message, variant: "destructive" });
    },
  });

  const copyShareLink = () => {
    if (!brief) return;
    const url = `${window.location.origin}/brief/${brief.publicUuid}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Share link copied to clipboard" });
    });
  };

  if (isLoading) {
    return (
      <PageShell>
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-3/4" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </PageShell>
    );
  }

  if (!brief) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">Brief not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted, or the link is out of date.
          </p>
          <Link href="/briefs">
            <Button variant="outline" size="sm" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              All briefs
            </Button>
          </Link>
        </div>
      </PageShell>
    );
  }

  const content = brief.content as BriefContent | null;
  const isStale =
    brief.status === "generating" &&
    (!brief.updatedAt || Date.now() - new Date(brief.updatedAt).getTime() > STALE_GENERATING_MS);
  const isGenerating = brief.status === "generating" && !isStale;
  const canGenerate = !isGenerating;

  return (
    <PageShell>
      {/* Header */}
      <Link
        href="/briefs"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All briefs
      </Link>
      <PageHeader
        eyebrow="Brief"
        title={<span className="break-words">{brief.title}</span>}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
            {brief.status === "ready" && (
              <Button variant="outline" size="sm" onClick={copyShareLink}>
                {copied ? (
                  <><Check className="h-4 w-4 mr-1.5" />Copied</>
                ) : (
                  <><Copy className="h-4 w-4 mr-1.5" />Share link</>
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={!canGenerate || generateMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Generating…" : "Regenerate"}
            </Button>
          </>
        }
      >
        <div className="-mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge status={brief.status} />
          <Badge variant="outline" className="text-xs shadow-none">
            {brief.sensitivity === "internal" ? (
              <><Lock className="h-3 w-3 mr-1" />Internal</>
            ) : (
              <><Share2 className="h-3 w-3 mr-1" />Shareable</>
            )}
          </Badge>
        </div>
      </PageHeader>

      {/* Generating state */}
      {isGenerating && <GeneratingSteps sources={brief.sources} />}

      {/* Interrupted run (e.g. the server restarted mid-generation) */}
      {isStale && (
        <Card className="mb-6 border-primary/20 bg-primary/5 shadow-none">
          <CardContent className="py-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">This is taking longer than expected</p>
              <p className="text-sm text-muted-foreground mt-1">The run was probably interrupted. Start it again:</p>
              <Button size="sm" className="mt-3" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {brief.status === "failed" && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Generation failed</p>
                {brief.generationError && (
                  <p className="text-sm text-muted-foreground mt-1">{brief.generationError}</p>
                )}
                <Button size="sm" className="mt-3" onClick={() => generateMutation.mutate()}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Try again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draft state (no content yet) */}
      {brief.status === "draft" && !content && (
        <Card className="mb-6">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-semibold">Draft saved</p>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              Generate the brief when your sources are ready.
            </p>
            <Button onClick={() => generateMutation.mutate()}>
              <FileText className="h-4 w-4 mr-2" />
              Generate brief
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Brief content */}
      {content && (
        // Two columns on wide screens: the brief on the left, its sources
        // pinned alongside so citations can be checked without scrolling.
        <div className={`grid items-start gap-6 ${brief.sources.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="min-w-0 space-y-4">
          {content.bottomLine && (
            <BottomLine level={content.bottomLine.level}>
              <CitedText text={content.bottomLine.answer} sources={brief.sources} />
            </BottomLine>
          )}

          <Section title="The Situation">
            <p className="text-sm leading-relaxed">
              <CitedText text={content.situation} sources={brief.sources} />
            </p>
          </Section>

          <Section title="Why It Matters to You">
            <p className="text-sm leading-relaxed">
              <CitedText text={content.whyItMatters} sources={brief.sources} />
            </p>
          </Section>

          <Section title="Stakes Across Three Dimensions">
            <div className="grid gap-4 md:grid-cols-3">
              <StakeDimension label="Business" text={content.stakes.business} sources={brief.sources} />
              <StakeDimension label="Reputational" text={content.stakes.reputational} sources={brief.sources} />
              <StakeDimension label="Values" text={content.stakes.values} sources={brief.sources} />
            </div>
          </Section>

          <Section title="Questions Worth Sitting With">
            <ol className="list-decimal list-inside space-y-2">
              {content.questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <CitedText text={q} sources={brief.sources} />
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Three Ways to Respond">
            <div className="grid gap-3 xl:grid-cols-3">
              <ResponseOption
                label="Cautious"
                color="text-primary"
                bg="border border-border bg-muted/40"
                text={content.responses.cautious}
                sources={brief.sources}
              />
              <ResponseOption
                label="Moderate"
                color="text-amber-700 dark:text-amber-400"
                bg="border border-border bg-muted/40"
                text={content.responses.moderate}
                sources={brief.sources}
              />
              <ResponseOption
                label="Aggressive"
                color="text-[#A53B39] dark:text-red-400"
                bg="border border-border bg-muted/40"
                text={content.responses.aggressive}
                sources={brief.sources}
              />
            </div>
          </Section>

        </div>

        <aside className="space-y-4 lg:sticky lg:top-4">
          {/* Sources */}
          {brief.sources.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {brief.sources.map((s) => (
                  <div key={s.id} id={`source-${s.citationNumber}`} className="flex items-start gap-2 text-sm scroll-mt-4">
                    <span className="text-primary font-semibold shrink-0">[{s.citationNumber}]</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline font-medium line-clamp-2"
                        >
                          {s.title ?? s.url}
                        </a>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                        {tierBadge(s.tier)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        {s.publication && <span>{s.publication}</span>}
                        {s.publishDate && <span>· {s.publishDate}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* View analytics (if ready) */}
          {brief.status === "ready" && <ViewCount briefId={id!} />}
        </aside>
        </div>
      )}

      <EditDialog brief={brief} open={editOpen} onOpenChange={setEditOpen} />
    </PageShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type StepState = "done" | "active" | "todo";

// Progress while a brief generates. Every source gets a publication name once
// it has been read, so that marks the hand-off from reading to writing.
function GeneratingSteps({ sources }: { sources: BriefSource[] }) {
  const found = sources.length > 0;
  const read = found && sources.every((s) => s.publication);
  const steps: Array<{ label: string; detail: string; state: StepState }> = [
    {
      label: found ? `Found ${sources.length} source${sources.length === 1 ? "" : "s"}` : "Finding sources",
      detail: "Congress.gov, agency press releases, and recent news",
      state: found ? "done" : "active",
    },
    { label: "Reading them", detail: "Pulling the full text of each source", state: read ? "done" : found ? "active" : "todo" },
    { label: "Writing the answer", detail: "Every claim cited to a source", state: read ? "active" : "todo" },
  ];

  return (
    <Card className="mb-6">
      <CardContent className="py-5 space-y-4">
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.detail} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {step.state === "done" ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : step.state === "active" ? (
                  <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                )}
              </span>
              <div className={step.state === "todo" ? "text-muted-foreground" : ""}>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        {found && (
          <ul className="border-t pt-3 space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <span className="text-xs font-semibold text-primary shrink-0">[{s.citationNumber}]</span>
                <span className="truncate">{s.title ?? s.url}</span>
                {s.publication && <span className="shrink-0 text-xs">· {s.publication}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Usually about a minute. You can leave this page; the brief keeps going.</p>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StakeDimension({
  label, text, sources,
}: { label: string; text: string; sources: BriefSource[] }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className="text-sm mt-0.5 leading-relaxed">
        <CitedText text={text} sources={sources} />
      </p>
    </div>
  );
}

function ResponseOption({
  label, color, bg, text, sources,
}: { label: string; color: string; bg: string; text: string; sources: BriefSource[] }) {
  return (
    <div className={`rounded-lg p-3 ${bg}`}>
      <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</span>
      <p className="text-sm mt-1 leading-relaxed">
        <CitedText text={text} sources={sources} />
      </p>
    </div>
  );
}

function ViewCount({ briefId }: { briefId: string }) {
  const { data } = useQuery<Array<{ email: string; viewedAt: string }>>({
    queryKey: [`/api/briefs/${briefId}/views`],
  });

  if (!data || data.length === 0) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Eye className="h-4 w-4" />
        <span>
          Viewed {data.length} time{data.length !== 1 ? "s" : ""} by{" "}
          {Array.from(new Set(data.map((v) => v.email))).join(", ")}
        </span>
      </CardContent>
    </Card>
  );
}
