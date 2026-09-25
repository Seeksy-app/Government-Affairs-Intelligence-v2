import { useEffect, useRef, useState } from "react";
import { ArrowRight, BarChart3, Check, CloudSun, Loader2, MessageCircleQuestion, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GaMark } from "@/components/ga-mark";
import { friendlyError } from "@/lib/api-errors";

export interface BuildResult {
  agencies: string[];
  importantNews: number;
  pressReleases: number;
  rescored: number;
  states: string[];
  clients: string[];
  portalsCreated: string[];
}

export interface BuildPlan {
  firmName: string;
  areas: number;
  issues: number;
  weather: "often" | "sometimes" | "rarely" | undefined;
  markets: "yes" | "sometimes" | "no" | undefined;
  clients: string[];
}

type Step = { key: string; title: string; detail: (r: BuildResult | null) => string; needsResult?: boolean };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listOf = (xs: string[], max = 3) =>
  xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} and ${xs.length - max} more`;

function stepsFor(plan: BuildPlan): Step[] {
  const steps: Step[] = [
    {
      key: "practice",
      title: "Reading your practice",
      detail: () =>
        [plan.areas && plural(plan.areas, "policy area"), plan.issues && plural(plan.issues, "specific issue")]
          .filter(Boolean)
          .join(" · ") || "Your focus areas",
    },
    {
      key: "press",
      title: "Connecting agency press feeds",
      needsResult: true,
      detail: (r) =>
        r && r.agencies.length
          ? `${listOf(r.agencies, 5)} · ${plural(r.pressReleases, "release")} this week`
          : "No agency feeds yet. Add agencies anytime.",
    },
    {
      key: "news",
      title: `Ranking two weeks of news for ${plan.firmName}`,
      needsResult: true,
      detail: (r) =>
        r ? `${plural(r.importantNews, "important story", "important stories")} this week` : "",
    },
  ];
  if (plan.weather !== "rarely") {
    steps.push({
      key: "weather",
      title: "Setting up Weather watch",
      needsResult: true,
      detail: (r) => (r && r.states.length ? `Washington, D.C. + ${listOf(r.states, 6)}` : "Washington, D.C. and national alerts"),
    });
  }
  if (plan.clients.length) {
    steps.push({
      key: "clients",
      title: "Loading guidance for your clients",
      detail: () => `${listOf(plan.clients)}, including what not to say`,
    });
    steps.push({
      key: "portals",
      title: "Preparing client portals",
      needsResult: true,
      detail: (r) =>
        r && r.portalsCreated.length
          ? `${listOf(r.portalsCreated)}: switched off until you share`
          : "None needed. You'll communicate directly.",
    });
  }
  steps.push({ key: "today", title: "Arranging your Today page", detail: () => "Your answers first, the rest a scroll away" });
  return steps;
}

const STEP_MS = 1150;

// The "building your dashboard" moment. The server call (onboarding complete:
// fold in clients, re-score news, count releases, set up portals) runs while
// each step is narrated; steps that report real numbers wait for it.
export function BuildingDashboard({
  plan,
  run,
  onFinish,
}: {
  plan: BuildPlan;
  run: () => Promise<BuildResult>;
  onFinish: () => void;
}) {
  const steps = useRef(stepsFor(plan)).current;
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0); // steps completed
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    run()
      .then((r) => alive && setResult(r))
      .catch((e: Error) => alive && setError(friendlyError(e)));
    return () => {
      alive = false;
    };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done >= steps.length || error) return;
    const next = steps[done];
    if (next.needsResult && !result) return; // wait for the server
    const t = setTimeout(() => setDone((n) => n + 1), done === 0 ? 900 : STEP_MS);
    return () => clearTimeout(t);
  }, [done, result, error, steps]);

  const finished = done >= steps.length;
  const pct = Math.round((done / steps.length) * 100);
  const reached = (key: string) => steps.findIndex((s) => s.key === key) < done;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#14253D] text-white"
      style={{ backgroundImage: "radial-gradient(1200px 600px at 70% -10%, rgba(7,138,203,0.28), transparent 60%)" }}
      role="status"
      aria-live="polite"
      data-testid="building-dashboard"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:gap-16 lg:px-10">
        {/* Narration */}
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center gap-3">
            <span className="relative">
              <GaMark size={44} inverted />
              {!finished && (
                <span className="absolute -inset-1.5 rounded-[14px] border-2 border-[#6CC3EE]/60 motion-safe:animate-ping" aria-hidden />
              )}
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6CC3EE]">
                {finished ? "Ready" : "Building your dashboard"}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {finished ? `Your Today page is ready.` : `Setting up ${plan.firmName}`}
              </h1>
            </div>
          </div>

          <ol className="space-y-3.5">
            {steps.map((s, i) => {
              const state = i < done ? "done" : i === done && !error ? "active" : "pending";
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 transition-opacity duration-500 ${state === "pending" ? "opacity-35" : "opacity-100"}`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                      state === "done" ? "bg-[#078ACB] text-white" : state === "active" ? "bg-white/10" : "border border-white/25"
                    }`}
                  >
                    {state === "done" ? (
                      <Check className="h-3.5 w-3.5 motion-safe:animate-in motion-safe:zoom-in" strokeWidth={3} />
                    ) : state === "active" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6CC3EE]" />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-snug">{s.title}</p>
                    {state === "done" && (
                      <p className="mt-0.5 text-sm text-white/65 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
                        {s.detail(result)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="mt-6 rounded-lg bg-[#A53B39]/25 p-4 ring-1 ring-[#A53B39]/60">
              <p className="text-sm font-semibold">We hit a snag finishing setup.</p>
              <p className="mt-1 text-sm text-white/75">{error} Your answers are saved.</p>
              <Button
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-3 bg-white text-[#14253D] hover:bg-white/90"
                size="sm"
              >
                <RotateCcw className="h-4 w-4" /> Try again
              </Button>
            </div>
          )}

          <div className="mt-8">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#078ACB] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
            </div>
            {finished && (
              <Button
                size="lg"
                onClick={onFinish}
                className="mt-6 bg-[#078ACB] px-6 text-white hover:bg-[#0679b0] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                data-testid="button-open-today"
                autoFocus
              >
                Open Today <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Miniature Today page assembling itself */}
        <div className="hidden w-full max-w-lg lg:block xl:max-w-xl" aria-hidden>
          <div className="rounded-2xl bg-[#F7F6F2] p-3 shadow-2xl ring-1 ring-white/10">
            <Piece show={reached("practice")}>
              <div className="flex items-center justify-between rounded-lg bg-[#14253D] p-3">
                <div className="space-y-1.5">
                  <div className="h-2 w-16 rounded bg-[#6CC3EE]/70" />
                  <div className="h-3 w-32 rounded bg-white/90" />
                  <div className="h-1.5 w-40 rounded bg-white/35" />
                </div>
                {plan.weather !== "rarely" && (
                  <Piece show={reached("weather")} className="flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1.5">
                    <CloudSun className="h-5 w-5 text-white" />
                    <div className="h-2.5 w-7 rounded bg-white/80" />
                  </Piece>
                )}
              </div>
            </Piece>

            <div className="mt-2.5 grid grid-cols-3 gap-2.5">
              <div className="col-span-2 space-y-2.5">
                <Piece show={reached(plan.clients.length ? "clients" : "news")}>
                  <div className="mb-1.5 flex items-center gap-1">
                    <MessageCircleQuestion className="h-3 w-3 text-[#078ACB]" />
                    <div className="h-1.5 w-20 rounded bg-[#14253D]/60" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["bg-emerald-500", "bg-amber-500", "bg-[#078ACB]"].map((c) => (
                      <div key={c} className="overflow-hidden rounded-md bg-white shadow-sm">
                        <div className={`h-0.5 ${c}`} />
                        <div className="space-y-1 p-1.5">
                          <div className="h-1.5 w-full rounded bg-slate-300" />
                          <div className="h-1.5 w-2/3 rounded bg-slate-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Piece>
                <Piece show={reached("news")}>
                  <div className="space-y-1.5">
                    {[92, 84, 77, 70].map((n, i) => (
                      <div
                        key={n}
                        className="flex items-center justify-between rounded-md border-l-2 border-[#078ACB] bg-white px-2 py-1.5 shadow-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2"
                        style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}
                      >
                        <div className="space-y-1">
                          <div className="h-1.5 w-28 rounded bg-slate-300" />
                          <div className="h-1 w-20 rounded bg-slate-200" />
                        </div>
                        <span className="rounded bg-[#078ACB]/10 px-1 text-[8px] font-bold text-[#078ACB]">{n}</span>
                      </div>
                    ))}
                  </div>
                </Piece>
              </div>
              <div className="space-y-2.5">
                {plan.weather !== "rarely" && (
                  <Piece show={reached("weather")} className="rounded-md bg-white p-1.5 shadow-sm">
                    <div className="mb-1 h-1 w-10 rounded bg-slate-400" />
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded bg-amber-200" />
                      <div className="h-1.5 w-4/5 rounded bg-slate-200" />
                    </div>
                  </Piece>
                )}
                <Piece show={reached("press")} className="rounded-md bg-white p-1.5 shadow-sm">
                  <div className="mb-1 h-1 w-10 rounded bg-slate-400" />
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="mt-1 flex justify-between">
                      <div className="h-1.5 w-12 rounded bg-slate-200" />
                      <div className="h-1.5 w-3 rounded bg-slate-300" />
                    </div>
                  ))}
                </Piece>
                {plan.markets === "yes" && (
                  <Piece show={reached("today")} className="rounded-md bg-white p-1.5 shadow-sm">
                    <BarChart3 className="mb-1 h-3 w-3 text-slate-400" />
                    <div className="h-1 overflow-hidden rounded bg-slate-200">
                      <div className="h-full w-2/3 bg-[#078ACB]" />
                    </div>
                  </Piece>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Piece({ show, className = "", children }: { show: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        show ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
