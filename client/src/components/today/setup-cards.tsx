import { Link } from "wouter";
import { ArrowRight, Loader2, Sparkle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAskBrief } from "@/components/briefs/ask-box";
import type { FirmClient } from "@shared/schema";

// A question worth asking before the client does. Naming the business gives
// source discovery something concrete to search for.
export function suggestedQuestion(c: FirmClient): string {
  const who = c.business ? `${c.name} (${c.business.slice(0, 160)})` : c.name;
  return `Is there anything in this week's federal policy news that ${who} should be worried about?`;
}

// For firms set up before onboarding existed: an invitation, not a gate.
export function SetupInvite() {
  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#078ACB]/30 bg-[#078ACB]/[0.05] px-5 py-4"
      data-testid="card-setup-invite"
    >
      <div className="min-w-0">
        <p className="font-semibold">Tailor this page to your practice</p>
        <p className="text-sm text-muted-foreground">
          About ten minutes: your clients, what never to say about them, and what belongs on Today.
        </p>
      </div>
      <Button asChild className="bg-[#078ACB] text-white hover:bg-[#0679b0]">
        <Link href="/onboarding">
          Start setup <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

// Right after onboarding: the first question is the moment the product
// clicks, so offer it for the firm's own clients.
export function WelcomeCard({ clients, onDismiss }: { clients: FirmClient[]; onDismiss: () => void }) {
  const ask = useAskBrief();
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border bg-card p-5 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
      data-testid="card-welcome"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[#078ACB]" />
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#078ACB]">
        <Sparkle className="h-3.5 w-3.5" /> Built from your answers
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight">Your Today page is ready.</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {clients.length
          ? "Try your first question. It uses the client's goals and follows their “never say” list."
          : "Try your first question, or add clients in Settings to tailor answers to each one."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {clients.slice(0, 3).map((c) => (
          <Button
            key={c.id}
            variant="outline"
            disabled={ask.isPending}
            onClick={() => ask.mutate({ question: suggestedQuestion(c), firmClientId: c.id })}
            className="h-auto max-w-full whitespace-normal py-2 text-left"
            data-testid={`welcome-ask-${c.id}`}
          >
            {ask.isPending && ask.variables?.firmClientId === c.id && <Loader2 className="h-4 w-4 animate-spin" />}
            Should {c.name} be worried about this week's news?
          </Button>
        ))}
        <Button asChild variant="ghost" className="text-[#078ACB]">
          <Link href="/briefs">
            Ask your own <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Clients whose owner said "get ahead of it": one tap to the answer.
export function GetAhead({ clients }: { clients: FirmClient[] }) {
  const ask = useAskBrief();
  const eager = clients.filter((c) => c.proactive === "yes").slice(0, 4);
  if (eager.length === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="get-ahead">
      <span className="text-xs font-semibold text-muted-foreground">Get ahead of it:</span>
      {eager.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={ask.isPending}
          onClick={() => ask.mutate({ question: suggestedQuestion(c), firmClientId: c.id })}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#078ACB]/40 bg-[#078ACB]/[0.06] px-3 py-1 text-xs font-semibold text-[#078ACB] transition-colors hover:bg-[#078ACB]/[0.12] disabled:opacity-60 dark:text-[#6CC3EE]"
          data-testid={`get-ahead-${c.id}`}
        >
          {ask.isPending && ask.variables?.firmClientId === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
          Should {c.name} be worried this week?
        </button>
      ))}
    </div>
  );
}
