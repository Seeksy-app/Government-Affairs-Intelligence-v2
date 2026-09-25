import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Eye, Loader2, MessageCircleQuestion, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openAIChat } from "@/components/global-ai-chat";
import { useAuth } from "@/hooks/use-auth";
import { useFirmSetup } from "@/hooks/use-firm-setup";
import { GetAhead } from "@/components/today/setup-cards";
import type { Brief, ConcernLevel } from "@shared/schema";

const LEVEL: Record<ConcernLevel, { label: string; icon: typeof Eye; pill: string; bar: string }> = {
  low: { label: "Low concern", icon: ShieldCheck, pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", bar: "bg-emerald-500" },
  watch: { label: "Worth watching", icon: Eye, pill: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", bar: "bg-amber-500" },
  act: { label: "Act now", icon: ShieldAlert, pill: "bg-[#A53B39] text-white", bar: "bg-[#A53B39]" },
};

// Strip the [n] citation markers for the short preview.
function preview(text: string) {
  return text.replace(/\s*\[\d+\](\[\d+\])*/g, "").trim();
}

// "Should I be worried?" answers, front and center on Today: the firm's most
// recent questions with their bottom line, plus a way to ask a new one.
export function RecentQuestions() {
  const { user } = useAuth();
  const { data: briefs, isLoading } = useQuery<Brief[]>({
    queryKey: ["/api/briefs"],
    enabled: !!user,
    refetchInterval: (q) => ((q.state.data as Brief[] | undefined)?.some((b) => b.status === "generating") ? 5000 : false),
  });
  const recent = (briefs ?? []).slice(0, 3);
  const { data: setup } = useFirmSetup();

  return (
    <section className="mb-8" data-testid="section-recent-questions">
      {/* The ask action sits with its heading (not out by the rail) and opens
          the Research assistant panel, so asking doesn't leave Today. */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <MessageCircleQuestion className="h-5 w-5 text-primary" />
              Should I be worried?
            </h2>
            <Button size="sm" onClick={() => openAIChat()} data-testid="button-ask-question">
              Ask a question <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Your latest questions and their bottom lines.</p>
        </div>
        {briefs && briefs.length > 3 && (
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/briefs">See all {briefs.length}</Link>
          </Button>
        )}
      </div>


      <GetAhead clients={setup?.clients ?? []} />

      {isLoading ? null : recent.length === 0 ? (
        <Link
          href="/briefs"
          className="block rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Paste a headline, a link or a bill number and get a calm, cited answer in about a minute.
        </Link>
      ) : (
        <div className={`grid gap-4 ${recent.length >= 3 ? "lg:grid-cols-3" : recent.length === 2 ? "lg:grid-cols-2" : ""}`}>
          {recent.map((b) => {
            const bl = b.content?.bottomLine;
            const meta = bl ? LEVEL[bl.level] : null;
            return (
              <Link
                key={b.id}
                href={`/briefs/${b.id}`}
                className="group relative flex flex-col overflow-hidden rounded-lg border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
                data-testid={`link-recent-brief-${b.id}`}
              >
                {meta && <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${meta.bar}`} />}
                <div className="mb-2 flex items-center justify-between gap-2">
                  {b.status === "generating" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" /> Writing the answer…
                    </span>
                  ) : meta ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.pill}`}>
                      <meta.icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                  ) : (
                    <span />
                  )}
                  {b.updatedAt && (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(b.updatedAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className="text-base font-semibold leading-snug transition-colors group-hover:text-primary line-clamp-2">{b.title}</p>
                {bl && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-4">{preview(bl.answer)}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
