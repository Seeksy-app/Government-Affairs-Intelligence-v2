import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  CloudSun,
  Loader2,
  Lock,
  MessageCircleQuestion,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { GaMark } from "@/components/ga-mark";
import { ChipPicker, ChoiceCards, FieldLabel, Question, TagInput } from "@/components/onboarding/fields";
import { ClientEditor } from "@/components/onboarding/client-editor";
import { BuildingDashboard, type BuildResult } from "@/components/onboarding/building-dashboard";
import {
  AGENCIES,
  AI_COMFORT,
  COMMITTEES,
  MARKETS_INTEREST,
  POLICY_AREAS,
  PROACTIVE,
  ROLES,
  SHARING,
  STATES,
  TRIGGERS,
  WEATHER_IMPACT,
  type FirmOnboarding,
} from "@shared/onboarding";
import type { FirmClient } from "@shared/schema";
import type { FirmSetup as OnboardingData } from "@/hooks/use-firm-setup";

type FirmDraft = {
  industries: string[];
  watchlistTopics: string[];
  relevantAgencies: string[];
  relevantCommittees: string[];
  states: string[];
  onboarding: FirmOnboarding;
};

// Chapters → steps. The clients chapter has its own four layers per client
// (ClientEditor), which is where most of the time goes.
const CHAPTERS = [
  { title: "Your practice", steps: ["role", "focus", "agencies", "states"] },
  { title: "How you work", steps: ["triggers", "weather", "markets", "ai"] },
  { title: "Your clients", steps: ["clients"] },
  { title: "Review", steps: ["review"] },
] as const;
type StepId = "welcome" | (typeof CHAPTERS)[number]["steps"][number];
const STEPS: StepId[] = ["welcome", ...CHAPTERS.flatMap((c) => c.steps as readonly StepId[])];
const chapterOf = (s: StepId) => CHAPTERS.findIndex((c) => (c.steps as readonly string[]).includes(s));

const ISSUE_EXAMPLES = ["Overtime rule", "VA community care", "Medicare Advantage", "Tip credit", "Section 232 tariffs", "TRICARE"];
const COMMITTEE_EXAMPLES = ["Senate Aging", "House Small Business"];

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<OnboardingData>({ queryKey: ["/api/onboarding"] });

  const [step, setStep] = useState<StepId>("welcome");
  const [draft, setDraft] = useState<FirmDraft | null>(null);
  const [editing, setEditing] = useState<FirmClient | "new" | null>(null);
  const [building, setBuilding] = useState(false);

  // Seed the draft once, and resume where the user left off (or jump to
  // ?step=clients from Settings).
  useEffect(() => {
    if (!data || draft) return;
    const p = data.profile;
    setDraft({
      industries: p?.industries ?? [],
      watchlistTopics: p?.watchlistTopics ?? [],
      relevantAgencies: p?.relevantAgencies ?? [],
      relevantCommittees: p?.relevantCommittees ?? [],
      states: p?.states ?? [],
      onboarding: p?.onboarding ?? {},
    });
    const want = new URLSearchParams(search).get("step") as StepId | null;
    if (want && STEPS.includes(want)) setStep(want);
    else if (data.onboarded) setStep("role");
    else if (p?.onboarding?.step) setStep(STEPS[Math.min(p.onboarding.step, STEPS.length - 1)]);
  }, [data, draft, search]);

  const save = useMutation({
    mutationFn: async (body: Partial<FirmDraft>) => (await apiRequest("PUT", "/api/onboarding/firm", body)).json(),
    onError: (err: Error) => toast({ title: "Couldn't save", description: friendlyError(err), variant: "destructive" }),
  });

  const removeClient = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/firm-clients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] }),
  });

  const idx = STEPS.indexOf(step);
  const go = (to: StepId) => {
    setStep(to);
    document.getElementById("onboarding-main")?.scrollTo({ top: 0 });
  };

  // Saves what this step changed, then moves on. Functional update, so a
  // delayed call (pick) never merges into an out-of-date draft.
  const next = async (patch?: Partial<FirmDraft>) => {
    if (!draft) return;
    setDraft((d) => d && { ...d, ...patch, onboarding: { ...d.onboarding, ...patch?.onboarding } });
    const to = STEPS[Math.min(idx + 1, STEPS.length - 1)];
    const body: Partial<FirmDraft> = { ...patch, onboarding: { ...patch?.onboarding, step: STEPS.indexOf(to) } };
    try {
      await save.mutateAsync(body);
      go(to);
    } catch {
      /* toast shown */
    }
  };

  // Single-choice questions advance on their own after a beat. One pending
  // advance at a time (a second click replaces it), none after unmount.
  const pickTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(pickTimer.current), []);
  const pick = <K extends keyof FirmOnboarding>(key: K, value: FirmOnboarding[K]) => {
    if (!draft) return;
    setDraft((d) => d && { ...d, onboarding: { ...d.onboarding, [key]: value } });
    clearTimeout(pickTimer.current);
    pickTimer.current = setTimeout(() => next({ onboarding: { [key]: value } as FirmOnboarding }), 280);
  };

  const plan = useMemo(
    () => ({
      firmName: data?.firmName ?? "your firm",
      areas: draft?.industries.length ?? 0,
      issues: draft?.watchlistTopics.length ?? 0,
      weather: draft?.onboarding.weather,
      markets: draft?.onboarding.markets,
      clients: (data?.clients ?? []).map((c) => c.name),
    }),
    [data, draft],
  );

  if (isLoading || !draft || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (building) {
    return (
      <BuildingDashboard
        plan={plan}
        run={async () => (await apiRequest("POST", "/api/onboarding/complete")).json() as Promise<BuildResult>}
        onFinish={() => {
          for (const key of ["/api/onboarding", "/api/morning-brief", "/api/weather-watch", "/api/top-bar-counts", "/api/firm-clients", "/api/government-press/releases"]) {
            queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(key) });
          }
          navigate("/dashboard?welcome=1");
        }}
      />
    );
  }

  const chapter = chapterOf(step);
  const focusReady = draft.industries.length + draft.watchlistTopics.length + draft.relevantAgencies.length > 0;

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Chapter rail */}
      <aside className="hidden w-[300px] shrink-0 flex-col bg-[#14253D] px-7 py-8 text-white lg:flex xl:w-[340px]">
        <div className="flex items-center gap-2.5">
          <GaMark size={34} inverted />
          <span className="text-[15px] font-semibold tracking-tight">GovernmentAffairs.io</span>
        </div>
        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6CC3EE]">Setting up</p>
        <p className="mt-1 text-xl font-semibold leading-tight tracking-tight">{data.firmName ?? "Your firm"}</p>
        <ol className="mt-8 space-y-1">
          {CHAPTERS.map((c, i) => {
            const state = step === "welcome" ? "todo" : i < chapter ? "done" : i === chapter ? "current" : "todo";
            return (
              <li key={c.title}>
                <button
                  type="button"
                  onClick={() => (data.onboarded || i <= chapter) && go(c.steps[0] as StepId)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                    state === "current" ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      state === "done"
                        ? "bg-[#078ACB] text-white"
                        : state === "current"
                          ? "bg-white text-[#14253D]"
                          : "border border-white/30 text-white/60"
                    }`}
                  >
                    {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-[15px] ${state === "todo" ? "text-white/60" : "font-semibold"}`}>{c.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto rounded-lg bg-white/5 p-4 text-sm text-white/70 ring-1 ring-white/10">
          <Lock className="mb-2 h-4 w-4 text-[#6CC3EE]" />
          Your answers are private to your firm. Nothing here is shown to your clients.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: mobile progress + exit */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <GaMark size={26} />
            <span className="text-sm font-semibold">{step === "welcome" ? "Welcome" : CHAPTERS[chapter].title}</span>
          </div>
          <div className="hidden text-sm text-muted-foreground lg:block">
            {step !== "welcome" && `Step ${idx} of ${STEPS.length - 1}`}
          </div>
          {(data.onboarded || !data.needsOnboarding) && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground" data-testid="button-exit-onboarding">
              <X className="h-4 w-4" /> {data.onboarded ? "Close" : "Finish later"}
            </Button>
          )}
        </header>
        <div className="h-1 bg-muted">
          <div className="h-full bg-[#078ACB] transition-all duration-500" style={{ width: `${(idx / (STEPS.length - 1)) * 100}%` }} />
        </div>

        <main id="onboarding-main" className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
            {step === "welcome" && (
              <div data-testid="onboarding-welcome">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#078ACB]">Welcome</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Let's build your dashboard.</h1>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  We take a little extra time with onboarding because it matters, for you and for your clients. About ten
                  minutes here decides the news we rank for you, the agencies we watch, and how we write about each client,
                  down to the words we never use.
                </p>
                {/* An outline, not buttons: the one thing to click is "Let's begin". */}
                <p className="mt-8 text-sm font-semibold text-foreground">Four short chapters:</p>
                <ol className="mt-3 space-y-2.5">
                  {[
                    { t: "Your practice", d: "policy areas, agencies, committees and states" },
                    { t: "How you work", d: "what makes clients call, weather, markets, AI" },
                    { t: "Your clients", d: "goals, sore spots, what never to say, how they see your work" },
                    { t: "Review", d: "then we build your Today page while you watch" },
                  ].map((c, i) => (
                    <li key={c.t} className="flex items-baseline gap-3 text-[15px]">
                      <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-[#078ACB]">{i + 1}.</span>
                      <span>
                        <span className="font-semibold">{c.t}</span>
                        <span className="text-muted-foreground"> — {c.d}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> Private to your firm. Nothing is final: add or change anything later in Settings.
                </p>
                <Button size="lg" onClick={() => next()} className="mt-8 bg-[#078ACB] px-7 text-white hover:bg-[#0679b0]" data-testid="button-onboarding-start">
                  Let's begin <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {step === "role" && (
              <Question title="What best describes your work?" why="So examples and wording fit how you work.">
                <ChoiceCards options={ROLES} value={draft.onboarding.role} onChange={(v) => pick("role", v)} testId="choice-role" />
              </Question>
            )}

            {step === "focus" && (
              <>
                <Question
                  title="Which policy areas do you work in?"
                  subtitle="Pick all that apply across your clients. Don't see one? Add your own. You can always add more later."
                  why="Your morning brief and news are ranked against these."
                >
                  <ChipPicker
                    options={POLICY_AREAS.map((a) => ({ value: a, label: a }))}
                    value={draft.industries}
                    onChange={(v) => setDraft({ ...draft, industries: v })}
                    allowCustom="Add your own"
                    testId="chips-policy-areas"
                  />
                </Question>
                <Question
                  title="Any specific issues you're watching?"
                  subtitle="Rules, programs, bills or fights, in your own words. Press Enter after each. Add more anytime."
                  why="Specific issues count most when we rank news. “Overtime rule” finds more than “Labor”."
                >
                  <TagInput
                    value={draft.watchlistTopics}
                    onChange={(v) => setDraft({ ...draft, watchlistTopics: v })}
                    placeholder="e.g. overtime rule"
                    suggestions={ISSUE_EXAMPLES}
                    testId="input-issues"
                  />
                </Question>
              </>
            )}

            {step === "agencies" && (
              <>
                <Question
                  title="Which agencies matter to your clients?"
                  subtitle="Pick all that apply. You can always add more later."
                  why="Their press releases fill your Press page, and a story that names one ranks higher."
                >
                  <ChipPicker
                    options={AGENCIES.map((a) => ({ value: a.value, label: a.label }))}
                    value={draft.relevantAgencies}
                    onChange={(v) => setDraft({ ...draft, relevantAgencies: v })}
                    badge={(v) =>
                      AGENCIES.find((a) => a.value === v)?.feed ? (
                        <span title="Press releases collected" className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      ) : null
                    }
                    testId="chips-agencies"
                  />
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> We collect this agency's press releases today.
                  </p>
                </Question>
                <Question title="And congressional committees?" why="News about these panels (markups, hearings, letters) ranks higher.">
                  <ChipPicker
                    options={COMMITTEES.map((c) => ({ value: c, label: c }))}
                    value={draft.relevantCommittees}
                    onChange={(v) => setDraft({ ...draft, relevantCommittees: v })}
                    testId="chips-committees"
                  />
                  <div className="mt-3">
                    <FieldLabel hint="Anything not listed. Press Enter after each.">Other committees</FieldLabel>
                    <TagInput
                      value={draft.relevantCommittees.filter((c) => !COMMITTEES.includes(c))}
                      onChange={(v) => setDraft({ ...draft, relevantCommittees: [...draft.relevantCommittees.filter((c) => COMMITTEES.includes(c)), ...v] })}
                      placeholder="e.g. Senate Aging"
                      suggestions={COMMITTEE_EXAMPLES}
                    />
                  </div>
                </Question>
              </>
            )}

            {step === "states" && (
              <Question
                title="Which states do your clients operate in?"
                subtitle="Skip this if your work is purely federal."
                why="Weather watch flags storms, fires and disaster declarations in these states."
              >
                <div className="flex flex-wrap gap-1.5" data-testid="chips-states">
                  {STATES.map(([code, name]) => {
                    const on = draft.states.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        title={name}
                        aria-pressed={on}
                        onClick={() =>
                          setDraft({ ...draft, states: on ? draft.states.filter((s) => s !== code) : [...draft.states, code] })
                        }
                        className={`h-10 w-12 rounded-lg border text-sm font-semibold transition-colors ${
                          on ? "border-[#078ACB] bg-[#078ACB] text-white" : "bg-card hover:border-[#078ACB]/50"
                        }`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
                {draft.states.length > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {draft.states.map((s) => STATES.find(([c]) => c === s)?.[1]).join(", ")}
                  </p>
                )}
              </Question>
            )}

            {step === "triggers" && (
              <Question
                title="What usually makes a client pick up the phone?"
                subtitle="Pick the moments that send your clients looking for answers."
                why="Your morning brief ranks these moments higher, so you see them before the call comes."
              >
                <ChipPicker
                  options={TRIGGERS}
                  value={draft.onboarding.triggers ?? []}
                  onChange={(v) => setDraft({ ...draft, onboarding: { ...draft.onboarding, triggers: v } })}
                  testId="chips-triggers"
                />
              </Question>
            )}

            {step === "weather" && (
              <Question
                title="How much does weather affect your work with clients?"
                subtitle="Snow cancels fly-ins, storms postpone hearings, hurricanes become disaster-aid fights."
                why="Decides where storm, fire and disaster alerts sit on your Today page. The D.C. forecast in your header always stays."
              >
                <ChoiceCards options={WEATHER_IMPACT} value={draft.onboarding.weather} onChange={(v) => pick("weather", v)} columns={1} testId="choice-weather" />
              </Question>
            )}

            {step === "markets" && (
              <Question
                title="Would prediction markets help your research or decisions?"
                subtitle="Kalshi's live odds on elections, shutdowns and policy outcomes: a quick read on what traders expect to happen."
                why="Decides whether market odds appear on your Today page."
              >
                <ChoiceCards options={MARKETS_INTEREST} value={draft.onboarding.markets} onChange={(v) => pick("markets", v)} columns={1} testId="choice-markets" />
              </Question>
            )}

            {step === "ai" && (
              <Question
                title="How comfortable are you using AI?"
                subtitle="There's no wrong answer."
                why="Every answer here cites its sources either way. This sets how we present them to you."
              >
                <ChoiceCards options={AI_COMFORT} value={draft.onboarding.aiComfort} onChange={(v) => pick("aiComfort", v)} testId="choice-ai" />
              </Question>
            )}

            {step === "clients" &&
              (editing ? (
                <ClientEditor
                  key={editing === "new" ? "new" : editing.id}
                  client={editing === "new" ? null : editing}
                  onDone={() => setEditing(null)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div data-testid="onboarding-clients">
                  <Question
                    title="Tell us about the clients you represent."
                    subtitle="Four short layers per client: who they are, your relationship, how to talk with them, and how they see your work."
                    why="This is where answers get personal: every “Should I be worried?” about a client uses their goals and follows their “never say” list."
                  >
                    <div className="space-y-2.5">
                      {data.clients.map((c) => (
                        <div key={c.id} className="flex items-start gap-3 rounded-xl border bg-card p-4" data-testid={`firm-client-${c.id}`}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#14253D] text-sm font-bold text-white dark:bg-white/10">
                            {c.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{c.name}</p>
                            {c.business && <p className="truncate text-sm text-muted-foreground">{c.business}</p>}
                            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                              <span className="rounded-full bg-muted px-2 py-0.5">{PROACTIVE.find((p) => p.value === c.proactive)?.label}</span>
                              <span className="rounded-full bg-muted px-2 py-0.5">{SHARING.find((s) => s.value === c.sharing)?.label}</span>
                              {c.avoid && <span className="rounded-full bg-[#A53B39]/10 px-2 py-0.5 text-[#A53B39] dark:text-red-300">Has a “never say” list</span>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.confirm(`Remove ${c.name}?`) && removeClient.mutate(c.id)}
                            aria-label={`Remove ${c.name}`}
                            className="text-muted-foreground hover:text-[#A53B39]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditing("new")}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-[15px] font-semibold text-[#078ACB] transition-colors hover:border-[#078ACB] hover:bg-[#078ACB]/[0.04]"
                        data-testid="button-add-client"
                      >
                        <Plus className="h-5 w-5" /> {data.clients.length ? "Add another client" : "Add your first client"}
                      </button>
                    </div>
                    {data.clients.length === 0 && (
                      <p className="mt-3 text-sm text-muted-foreground">Start with the one who calls most. You can add the rest anytime.</p>
                    )}
                  </Question>
                </div>
              ))}

            {step === "review" && (
              <Review data={data} draft={draft} onEdit={go} />
            )}

            {/* Footer nav (single-choice steps advance on their own) */}
            {step !== "welcome" && !(step === "clients" && editing) && (
              <div className="mt-10 flex items-center justify-between gap-3 border-t pt-5">
                <Button variant="ghost" onClick={() => go(STEPS[idx - 1])} className="text-muted-foreground" data-testid="button-onboarding-back">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {step === "review" ? (
                  <Button
                    size="lg"
                    onClick={() => setBuilding(true)}
                    disabled={!focusReady}
                    className="bg-[#078ACB] px-7 text-white hover:bg-[#0679b0]"
                    data-testid="button-build-dashboard"
                  >
                    Build my dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    disabled={save.isPending || (step === "focus" && draft.industries.length + draft.watchlistTopics.length === 0)}
                    onClick={() => {
                      const patch: Partial<FirmDraft> =
                        step === "focus"
                          ? { industries: draft.industries, watchlistTopics: draft.watchlistTopics }
                          : step === "agencies"
                            ? { relevantAgencies: draft.relevantAgencies, relevantCommittees: draft.relevantCommittees }
                            : step === "states"
                              ? { states: draft.states }
                              : step === "triggers"
                                ? { onboarding: { triggers: draft.onboarding.triggers ?? [] } }
                                : step === "role" || step === "weather" || step === "markets" || step === "ai"
                                  ? { onboarding: { [step === "ai" ? "aiComfort" : step]: draft.onboarding[step === "ai" ? "aiComfort" : step] } as FirmOnboarding }
                                  : {};
                      next(patch);
                    }}
                    className="min-w-[150px] bg-[#078ACB] text-white hover:bg-[#0679b0]"
                    data-testid="button-onboarding-continue"
                  >
                    {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {step === "clients" && data.clients.length === 0 ? "Skip for now" : "Continue"}
                    {!save.isPending && <ArrowRight className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// What the dashboard will be built from, with a way back to each answer.
function Review({ data, draft, onEdit }: { data: OnboardingData; draft: FirmDraft; onEdit: (s: StepId) => void }) {
  const o = draft.onboarding;
  const label = <T extends { value: string; label: string }>(opts: T[], v?: string) => opts.find((x) => x.value === v)?.label;
  const withFeeds = draft.relevantAgencies.filter((a) => AGENCIES.find((x) => x.value === a)?.feed);
  const rows: Array<{ icon: typeof Newspaper; title: string; body: React.ReactNode; step: StepId; off?: boolean }> = [
    {
      icon: Newspaper,
      title: "Morning brief and news",
      body: [
        draft.industries.length && `${draft.industries.length} policy areas`,
        draft.watchlistTopics.length && `issues: ${draft.watchlistTopics.slice(0, 4).join(", ")}${draft.watchlistTopics.length > 4 ? "…" : ""}`,
        draft.relevantCommittees.length && `${draft.relevantCommittees.length} committees`,
        o.triggers?.length && `ranked toward ${o.triggers.length} trigger moments`,
      ]
        .filter(Boolean)
        .join(" · "),
      step: "focus",
    },
    {
      icon: Building2,
      title: "Press releases",
      body: withFeeds.length ? `From ${withFeeds.join(", ")}` : "Pick agencies to fill your Press page",
      step: "agencies",
      off: withFeeds.length === 0,
    },
    {
      icon: CloudSun,
      title: "Weather watch",
      body:
        o.weather === "rarely"
          ? "Alerts off (you told us weather rarely matters). The D.C. forecast stays in your header."
          : `D.C. forecast${draft.states.length ? ` + alerts for ${draft.states.join(", ")}` : " + national alerts"}${o.weather === "sometimes" ? ", kept compact" : ""}`,
      step: "weather",
      off: o.weather === "rarely",
    },
    {
      icon: MessageCircleQuestion,
      title: "Should I be worried?",
      body: data.clients.length
        ? `Tailored to ${data.clients.map((c) => c.name).join(", ")}, following each client's “never say” list`
        : "General answers. Add clients to tailor them.",
      step: "clients",
    },
    {
      icon: BarChart3,
      title: "Prediction markets",
      body: o.markets === "yes" ? "On your Today page" : "Available under Markets, not on Today",
      step: "markets",
      off: o.markets !== "yes",
    },
  ];
  const portals = data.clients.filter((c) => c.sharing !== "direct" && !c.portalId);

  return (
    <div data-testid="onboarding-review">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#078ACB]">Review</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Here's what we'll build.</h1>
      <p className="mt-2 text-muted-foreground">
        {label(ROLES, o.role) ?? "Your practice"}
        {o.aiComfort && ` · ${label(AI_COMFORT, o.aiComfort)}`}
      </p>
      <div className="mt-6 divide-y rounded-xl border bg-card">
        {rows.map((r) => (
          <div key={r.title} className="flex items-start gap-3.5 p-4">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                r.off ? "bg-muted text-muted-foreground" : "bg-[#078ACB]/10 text-[#078ACB]"
              }`}
            >
              <r.icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.title}</p>
              <p className="text-sm text-muted-foreground">{r.body || "Nothing chosen yet"}</p>
            </div>
            <button type="button" onClick={() => onEdit(r.step)} className="text-sm font-semibold text-[#078ACB] hover:underline">
              Edit
            </button>
          </div>
        ))}
      </div>
      {portals.length > 0 && (
        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          We'll set up portals for {portals.map((c) => c.name).join(", ")}, switched off until you choose to share.
        </p>
      )}
    </div>
  );
}
