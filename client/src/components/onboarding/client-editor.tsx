import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AVOID_EXAMPLES,
  CLIENT_AI_COMFORT,
  POLICY_AREAS,
  PROACTIVE,
  SHARING,
  type AiComfort,
  type Proactive,
  type Sharing,
} from "@shared/onboarding";
import type { FirmClient } from "@shared/schema";
import { ChipPicker, ChoiceCards, FieldLabel, Question, WhyWeAsk } from "./fields";

type Draft = {
  name: string;
  business: string;
  industries: string[];
  goals: string;
  relationship: string;
  friction: string;
  proactive: Proactive;
  avoid: string;
  aiComfort: AiComfort | null;
  sharing: Sharing;
};

const fromClient = (c: FirmClient | null): Draft => ({
  name: c?.name ?? "",
  business: c?.business ?? "",
  industries: c?.industries ?? [],
  goals: c?.goals ?? "",
  relationship: c?.relationship ?? "",
  friction: c?.friction ?? "",
  proactive: c?.proactive ?? "ask",
  avoid: c?.avoid ?? "",
  aiComfort: c?.aiComfort ?? null,
  sharing: c?.sharing ?? "mix",
});

const PARTS = ["Who they are", "Your relationship", "How to talk with them", "How they see your work"];

// One client, four layers deep. Each layer saves as you go, so leaving
// halfway keeps what was entered.
export function ClientEditor({
  client,
  onDone,
  onCancel,
}: {
  client: FirmClient | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [id, setId] = useState<string | null>(client?.id ?? null);
  const [part, setPart] = useState(0);
  const [d, setD] = useState<Draft>(() => fromClient(client));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const who = d.name.trim() || "this client";

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: d.name.trim(),
        business: d.business.trim() || null,
        industries: d.industries,
        goals: d.goals.trim() || null,
        relationship: d.relationship.trim() || null,
        friction: d.friction.trim() || null,
        proactive: d.proactive,
        avoid: d.avoid.trim() || null,
        aiComfort: d.aiComfort,
        sharing: d.sharing,
      };
      const res = id
        ? await apiRequest("PATCH", `/api/firm-clients/${id}`, body)
        : await apiRequest("POST", "/api/firm-clients", body);
      return (await res.json()) as FirmClient;
    },
    onSuccess: (row) => {
      setId(row.id);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/firm-clients"] });
      if (part < PARTS.length - 1) setPart(part + 1);
      else onDone();
    },
    onError: (err: Error) => toast({ title: "Couldn't save", description: friendlyError(err), variant: "destructive" }),
  });

  const canContinue = d.name.trim().length > 0 && !save.isPending;

  return (
    <div data-testid="client-editor">
      {/* Layer progress */}
      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#078ACB]">
          {client ? "Edit client" : "New client"} · {part + 1} of {PARTS.length}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {PARTS.map((p, i) => (
            <button
              key={p}
              type="button"
              disabled={!id && i > 0}
              onClick={() => setPart(i)}
              className="group text-left disabled:cursor-not-allowed"
            >
              <span
                className={`block h-1.5 rounded-full transition-colors ${i <= part ? "bg-[#078ACB]" : "bg-muted group-enabled:group-hover:bg-muted-foreground/30"}`}
              />
              <span className={`mt-1.5 hidden text-xs sm:block ${i === part ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                {p}
              </span>
            </button>
          ))}
        </div>
      </div>

      {part === 0 && (
        <>
          <Question title="Who is the client?" why="Their name and business shape every answer you ask about them, and their industries tune your news.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Client name</FieldLabel>
                <Input
                  autoFocus
                  value={d.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Mid-Atlantic Hospitality Alliance"
                  maxLength={160}
                  className="h-11 text-[15px]"
                  data-testid="input-client-name"
                />
              </div>
              <div>
                <FieldLabel>Their main business</FieldLabel>
                <Input
                  value={d.business}
                  onChange={(e) => set("business", e.target.value)}
                  placeholder="e.g. Trade group for 400 hotels and restaurants"
                  maxLength={500}
                  className="h-11 text-[15px]"
                  data-testid="input-client-business"
                />
              </div>
            </div>
          </Question>
          <Question title={`Which industries is ${who} in?`} subtitle="Pick any that fit.">
            <ChipPicker
              options={POLICY_AREAS.map((a) => ({ value: a, label: a }))}
              value={d.industries}
              onChange={(v) => set("industries", v)}
              testId="chips-client-industries"
            />
          </Question>
        </>
      )}

      {part === 1 && (
        <>
          <Question title={`What are your goals with ${who}?`} why="Answers about this client lead with what you're trying to achieve for them.">
            <Textarea
              autoFocus
              value={d.goals}
              onChange={(e) => set("goals", e.target.value)}
              placeholder="e.g. Keep the overtime threshold at 2019 levels; secure a seat on the DOL small-business roundtable"
              rows={3}
              maxLength={2000}
              className="text-[15px]"
              data-testid="input-client-goals"
            />
          </Question>
          <Question title="What affects your relationship with them?" subtitle="What they value, how they like to work, who calls the shots.">
            <Textarea
              value={d.relationship}
              onChange={(e) => set("relationship", e.target.value)}
              placeholder="e.g. The CEO wants a heads-up before anything hits the press; the board meets quarterly"
              rows={3}
              maxLength={2000}
              className="text-[15px]"
              data-testid="input-client-relationship"
            />
          </Question>
          <Question title="Any friction points?" subtitle="Sore spots, past disappointments, internal disagreements.">
            <Textarea
              value={d.friction}
              onChange={(e) => set("friction", e.target.value)}
              placeholder="e.g. Frustrated we didn't see the 2024 rule coming; members split on tip-credit changes"
              rows={3}
              maxLength={2000}
              className="text-[15px]"
              data-testid="input-client-friction"
            />
          </Question>
        </>
      )}

      {part === 2 && (
        <>
          <Question
            title={`Should we help you get ahead of ${who}'s questions?`}
            why="Decides whether your Today page suggests questions about this client before they think to ask."
          >
            <ChoiceCards options={PROACTIVE} value={d.proactive} onChange={(v) => set("proactive", v)} columns={3} testId="choice-proactive" />
          </Question>
          <Question
            title="Most important: what should we never say?"
            subtitle="Words, framings, topics or names to stay away from in anything written about this client."
          >
            <Textarea
              value={d.avoid}
              onChange={(e) => set("avoid", e.target.value)}
              placeholder="One per line"
              rows={4}
              maxLength={2000}
              className="text-[15px]"
              data-testid="input-client-avoid"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">For example:</span>
              {AVOID_EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => set("avoid", d.avoid.trim() ? `${d.avoid.trim()}\n${ex}` : ex)}
                  className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-[#078ACB] hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
            <WhyWeAsk>
              Every answer about {who} follows these as hard rules. They're private to your firm and never shown to the client.
            </WhyWeAsk>
          </Question>
          <Question title={`How comfortable is ${who} with AI?`} why="If they're wary, answers are written in plain, firm-voice prose with no mention of AI.">
            <ChoiceCards options={CLIENT_AI_COMFORT} value={d.aiComfort} onChange={(v) => set("aiComfort", v)} testId="choice-client-ai" />
          </Question>
        </>
      )}

      {part === 3 && (
        <Question
          title={`How should ${who} see your work?`}
          why="You stay in control either way: nothing reaches a client unless you choose to share it."
        >
          <ChoiceCards options={SHARING} value={d.sharing} onChange={(v) => set("sharing", v)} columns={1} testId="choice-sharing" />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Portals start switched off, so the client's name stays private until you turn it on.
          </p>
        </Question>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (part === 0 ? onCancel() : setPart(part - 1))}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {part === 0 ? "Back to clients" : "Back"}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!canContinue}
          onClick={() => save.mutate()}
          className="min-w-[160px] bg-[#078ACB] text-white hover:bg-[#0679b0]"
          data-testid="button-client-continue"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {part === PARTS.length - 1 ? "Save client" : "Continue"}
          {!save.isPending && part < PARTS.length - 1 && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
