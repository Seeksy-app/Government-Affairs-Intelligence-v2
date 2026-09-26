import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Loader2, Microscope, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { BriefDeeper } from "@shared/schema";

const SOURCE_NAMES: Record<string, string> = {
  pubmed: "PubMed",
  clinical_trials: "ClinicalTrials.gov",
  cms_coverage: "CMS coverage decisions",
  chembl: "ChEMBL",
};
const STALE_MS = 5 * 60 * 1000;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// "Dig deeper": a longer research pass beneath an answer. Stored on the brief,
// so it's there next time; runs again on request.
export function DigDeeper({ briefId, deeper }: { briefId: string; deeper?: BriefDeeper }) {
  const { toast } = useToast();
  const start = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/briefs/${briefId}/deeper`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/briefs/${briefId}`] }),
    onError: (err: Error) => toast({ title: "Couldn't dig deeper", description: friendlyError(err), variant: "destructive" }),
  });

  const stale = deeper?.status === "running" && Date.now() - new Date(deeper.startedAt).getTime() > STALE_MS;
  const running = (deeper?.status === "running" && !stale) || start.isPending;
  const failed = deeper?.status === "failed" || stale;

  return (
    <section className="rounded-lg border bg-card p-5" data-testid="section-dig-deeper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Microscope className="h-4 w-4 text-primary" />
            {deeper?.status === "ready" ? "Deeper research" : "Dig deeper"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A longer search of primary sources. For health topics it also checks medical research, registered clinical trials and
            Medicare coverage decisions. Takes about a minute.
          </p>
        </div>
        {!running && (
          <Button
            variant={deeper?.status === "ready" ? "outline" : "default"}
            size="sm"
            onClick={() => start.mutate()}
            data-testid="button-dig-deeper"
          >
            {deeper?.status === "ready" || failed ? <RotateCcw className="h-4 w-4" /> : <Microscope className="h-4 w-4" />}
            {deeper?.status === "ready" ? "Run again" : failed ? "Try again" : "Dig deeper"}
          </Button>
        )}
      </div>

      {running && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Researching… this usually takes under a minute.
        </p>
      )}
      {failed && !running && (
        <p className="mt-4 text-sm text-[#A53B39]">{deeper?.error ?? "The deeper search didn't finish."}</p>
      )}

      {deeper?.status === "ready" && deeper.text && (
        <div className="mt-4 space-y-3">
          {deeper.text
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {p.replace(/\*\*/g, "")}
              </p>
            ))}
          {!!deeper.connectorsUsed?.length && (
            <p className="text-xs text-muted-foreground">
              Also checked: {deeper.connectorsUsed.map((c) => SOURCE_NAMES[c] ?? c).join(", ")}
            </p>
          )}
          {!!deeper.citations?.length && (
            <div className="border-t pt-3">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-foreground">Sources</p>
              <ol className="space-y-1">
                {deeper.citations.map((c, i) => (
                  <li key={c.url} className="flex items-start gap-2 text-xs">
                    <span className="w-4 shrink-0 text-right tabular-nums text-muted-foreground">{i + 1}.</span>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-primary hover:underline">
                      {c.title || hostOf(c.url)}
                      <span className="ml-1 text-muted-foreground">({hostOf(c.url)})</span>
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
