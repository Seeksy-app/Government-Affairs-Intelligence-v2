import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, MessageCircleQuestion } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    mutationFn: async (input: { question: string; clientContext?: string | null }) => {
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
  const ask = useAskBrief();

  const trimmed = question.trim();
  const canSubmit = trimmed.length >= 3 && !ask.isPending;

  const submit = () => {
    if (!canSubmit) return;
    ask.mutate({ question: trimmed, clientContext: clientContext.trim() || null });
  };

  return (
    <Card className="border-primary/25" data-testid="card-ask-box">
      <CardContent className="p-4 sm:p-5">
        {showHeading && (
          <>
            <div className="flex items-center gap-2">
              <MessageCircleQuestion className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold tracking-tight">Should I be worried?</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Paste a headline, a link, or a bill number, or just ask. We find the sources and write a
              calm, cited answer in about a minute.
            </p>
          </>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-2"
        >
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
            className="resize-none"
            data-testid="input-ask-question"
          />
          {showContext && (
            <Input
              value={clientContext}
              onChange={(e) => setClientContext(e.target.value)}
              placeholder="Who is this for? e.g. a regional hospital system worried about Medicaid cuts"
              maxLength={2000}
              data-testid="input-ask-context"
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (showContext) setClientContext("");
                setShowContext(!showContext);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showContext ? "Remove client context" : "+ Add client context"}
            </button>
            <Button type="submit" disabled={!canSubmit} data-testid="button-ask-submit">
              {ask.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Get the answer
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>

        {showExamples && !trimmed && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-xs text-muted-foreground">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors max-w-full truncate"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
