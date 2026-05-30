import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLink, FileText, Mail } from "lucide-react";
import type { BriefContent, BriefSource } from "@shared/schema";

type PublicBrief = {
  id: string;
  publicUuid: string;
  title: string;
  sensitivity: string;
  status: string;
  content: BriefContent;
  modelUsed: string | null;
  generatedAt: string | null;
  sources: BriefSource[];
};

// ─── Tier badge ───────────────────────────────────────────────────────────────

function tierBadge(tier: number) {
  if (tier === 1)
    return (
      <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ml-0.5">
        T1
      </span>
    );
  if (tier === 2)
    return (
      <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ml-0.5">
        T2
      </span>
    );
  return (
    <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold bg-muted text-muted-foreground ml-0.5">
      T3
    </span>
  );
}

// ─── Inline citation renderer ─────────────────────────────────────────────────

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

// ─── Email gate ───────────────────────────────────────────────────────────────

function EmailGate({
  publicUuid,
  onUnlocked,
}: {
  publicUuid: string;
  onUnlocked: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const logViewMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/briefs/public/${publicUuid}/view`, { email });
    },
    onSuccess: () => {
      onUnlocked(email);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    logViewMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <FileText className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-semibold mb-1">Decision Brief</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your email to view this brief
        </p>
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          <div>
            <Label htmlFor="email" className="sr-only">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={logViewMutation.isPending}>
            {logViewMutation.isPending ? "Unlocking..." : "View Brief"}
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Brief reading view ───────────────────────────────────────────────────────

function BriefReadingView({ brief }: { brief: PublicBrief }) {
  const content = brief.content;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Decision Brief
          </p>
          <h1 className="text-3xl font-bold leading-tight mb-3">{brief.title}</h1>
          {brief.generatedAt && (
            <p className="text-sm text-muted-foreground">
              Generated {new Date(brief.generatedAt).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </p>
          )}
        </div>

        {/* Divider */}
        <hr className="border-border mb-8" />

        {/* 5 sections */}
        <div className="space-y-8">
          <PublicSection number="01" title="The Situation">
            <p className="text-base leading-relaxed text-foreground">
              <CitedText text={content.situation} sources={brief.sources} />
            </p>
          </PublicSection>

          <PublicSection number="02" title="Why It Matters to You">
            <p className="text-base leading-relaxed text-foreground">
              <CitedText text={content.whyItMatters} sources={brief.sources} />
            </p>
          </PublicSection>

          <PublicSection number="03" title="Stakes Across Three Dimensions">
            <div className="space-y-4">
              {(["business", "reputational", "values"] as const).map((dim) => (
                <div key={dim}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    {dim.charAt(0).toUpperCase() + dim.slice(1)}
                  </p>
                  <p className="text-base leading-relaxed">
                    <CitedText text={content.stakes[dim]} sources={brief.sources} />
                  </p>
                </div>
              ))}
            </div>
          </PublicSection>

          <PublicSection number="04" title="Questions Worth Sitting With">
            <ol className="list-decimal list-inside space-y-3">
              {content.questions.map((q, i) => (
                <li key={i} className="text-base leading-relaxed">
                  <CitedText text={q} sources={brief.sources} />
                </li>
              ))}
            </ol>
          </PublicSection>

          <PublicSection number="05" title="Three Ways to Respond">
            <div className="space-y-4">
              {(
                [
                  { key: "cautious", label: "Cautious", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
                  { key: "moderate", label: "Moderate", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
                  { key: "aggressive", label: "Aggressive", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30" },
                ] as const
              ).map(({ key, label, color, bg }) => (
                <div key={key} className={`rounded-lg p-4 ${bg}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1.5 ${color}`}>
                    {label}
                  </p>
                  <p className="text-base leading-relaxed">
                    <CitedText text={content.responses[key]} sources={brief.sources} />
                  </p>
                </div>
              ))}
            </div>
          </PublicSection>
        </div>

        {/* Sources */}
        {brief.sources.length > 0 && (
          <>
            <hr className="border-border my-8" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Sources
              </p>
              <div className="space-y-3">
                {brief.sources.map((s) => (
                  <div
                    key={s.id}
                    id={`source-${s.citationNumber}`}
                    className="flex items-start gap-2 text-sm scroll-mt-8"
                  >
                    <span className="text-primary font-semibold shrink-0 mt-0.5">
                      [{s.citationNumber}]
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline font-medium"
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
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t text-center">
          <p className="text-xs text-muted-foreground">
            AI-generated decision brief · Powered by Government Affairs Intelligence
          </p>
        </div>
      </div>
    </div>
  );
}

function PublicSection({
  number, title, children,
}: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-xs font-bold text-muted-foreground/50">{number}</span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BriefPublic() {
  const { uuid } = useParams<{ uuid: string }>();
  const [unlockedEmail, setUnlockedEmail] = useState<string | null>(null);

  const { data: brief, isLoading, error } = useQuery<PublicBrief>({
    queryKey: [`/api/briefs/public/${uuid}`],
    enabled: !!uuid,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-1">Brief not found</h1>
          <p className="text-sm text-muted-foreground">
            This brief may not exist or may not be ready yet.
          </p>
        </div>
      </div>
    );
  }

  if (!unlockedEmail) {
    return (
      <EmailGate
        publicUuid={uuid!}
        onUnlocked={(email) => setUnlockedEmail(email)}
      />
    );
  }

  return <BriefReadingView brief={brief} />;
}
