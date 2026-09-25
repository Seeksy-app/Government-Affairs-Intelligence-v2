import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, MessageCircleQuestion } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFirmSetup } from "@/hooks/use-firm-setup";

const EXAMPLES = [
  "Is the proposed overtime rule a problem for our hospitality clients?",
  "H.R. 1",
  "Will the new tariff announcement hit medical device importers?",
];

// Starts an "ask" brief and opens it; the brief page shows progress.
export function useAskBrief() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: { question: string; clientContext?: string | null; firmClientId?: string | null }) => {
      const res = await apiRequest("POST", "/api/briefs/ask", input);
      return (await res.json()) as { id: string };
    },
    onSuccess: (brief) => {
      queryClient.invalidateQueries({ queryKey: ["/api/briefs"] });
      navigate(`/briefs/${brief.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't start the answer", description: friendlyError(err), variant: "destructive" });
    },
  });
}

export function AskBox({
  showExamples = true,
  showHeading = true,
}: {
  showExamples?: boolean;
  /** Off where the page title already says "Should I be worried?". */
  showHeading?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [clientContext, setClientContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  // One of the firm's own clients: their goals and "never say" list steer the answer.
  const [forClient, setForClient] = useState<string | null>(null);
  const ask = useAskBrief();
  const { data: setup } = useFirmSetup();
  const firmClients = setup?.clients ?? [];
  const wary = setup?.profile?.onboarding?.aiComfort === "never" || setup?.profile?.onboarding?.aiComfort === "dislikes";

  const trimmed = question.trim();
  const canSubmit = trimmed.length >= 3 && !ask.isPending;

  const submit = () => {
    if (!canSubmit) return;
    ask.mutate({ question: trimmed, clientContext: clientContext.trim() || null, firmClientId: forClient });
  };

  // A light card: one field with its button inside, options underneath.
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6" data-testid="card-ask-box">
      {showHeading && (
        <div className="mb-1 flex items-center gap-2">
          <MessageCircleQuestion className="h-5 w-5 shrink-0 text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">Should I be worried?</h2>
        </div>
      )}
      <p className="mb-3 text-sm text-muted-foreground">
        Paste a headline, a link, or a bill number, or just ask. We find the sources and write a calm, cited answer in
        about a minute.
        {wary && " Every sentence links to the source it came from, so you can check each claim yourself."}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="rounded-lg border bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`e.g. "${EXAMPLES[0]}"`}
            rows={2}
            maxLength={1000}
            className="resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            data-testid="input-ask-question"
          />
          {showContext && (
            <Input
              value={clientContext}
              onChange={(e) => setClientContext(e.target.value)}
              placeholder="Who is this for? e.g. a regional hospital system worried about Medicaid cuts"
              maxLength={2000}
              className="mx-3 mb-2 w-[calc(100%-1.5rem)]"
              data-testid="input-ask-context"
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {firmClients.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Which client is this about?">
                  <span className="text-xs font-semibold text-muted-foreground">About:</span>
                  {[{ id: null as string | null, name: "No client" }, ...firmClients].map((c) => {
                    const on = forClient === c.id;
                    return (
                      <button
                        key={c.id ?? "none"}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setForClient(c.id)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                          on ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:text-foreground"
                        }`}
                        data-testid={`ask-for-${c.id ?? "none"}`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (showContext) setClientContext("");
                  setShowContext(!showContext);
                }}
                className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {showContext ? "Remove context" : "+ Add context"}
              </button>
            </div>
            <Button type="submit" size="sm" disabled={!canSubmit} data-testid="button-ask-submit">
              {ask.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Get the answer
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {showExamples && !trimmed && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuestion(ex)}
              className="max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
