import { ExternalLink, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import type { TopicCardContent } from "@shared/schema";

export const LEVELS: Record<TopicCardContent["level"], { label: string; icon: typeof Eye; pill: string; bar: string }> = {
  low: { label: "Low concern", icon: ShieldCheck, pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", bar: "bg-emerald-500" },
  watch: { label: "Worth watching", icon: Eye, pill: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", bar: "bg-amber-500" },
  act: { label: "Act now", icon: ShieldAlert, pill: "bg-[#A53B39] text-white", bar: "bg-[#A53B39]" },
};

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
const asOfLabel = (d: string) => {
  const t = new Date(d + "T12:00:00");
  return isNaN(t.getTime()) ? d : t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// The card itself: one screen on a phone. Used in the editor preview and on
// the client's shared page.
export function CardView({ title, content, firmName }: { title: string; content: TopicCardContent; firmName?: string | null }) {
  const level = LEVELS[content.level] ?? LEVELS.watch;
  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid="topic-card">
      <div className={`h-1.5 ${level.bar}`} aria-hidden />
      <div className="space-y-5 p-5 sm:p-6">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${level.pill}`}>
              <level.icon className="h-3.5 w-3.5" />
              {level.label}
            </span>
            <span className="text-xs text-muted-foreground">As of {asOfLabel(content.asOf)}</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{title}</h1>
          {firmName && <p className="mt-1 text-xs text-muted-foreground">From {firmName}</p>}
        </header>

        <section>
          <h2 className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">What you need to know</h2>
          <p className="text-[15px] leading-relaxed">{content.know}</p>
        </section>

        {content.talkingPoints.length > 0 && (
          <section>
            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-primary">Top talking points</h2>
            <ol className="space-y-2">
              {content.talkingPoints.map((t, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-snug">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#14253D] text-xs font-bold text-white dark:bg-white/15">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {(content.pros.length > 0 || content.cons.length > 0) && (
          <section className="grid gap-3">
            {[
              { label: "Pros", items: content.pros, tone: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-900/20", mark: "+" },
              { label: "Cons", items: content.cons, tone: "border-[#A53B39]/20 bg-[#A53B39]/[0.05] dark:border-red-900 dark:bg-red-900/20", mark: "–" },
            ]
              .filter((c) => c.items.length)
              .map((c) => (
                <div key={c.label} className={`rounded-xl border p-3.5 ${c.tone}`}>
                  <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.1em]">{c.label}</h3>
                  <ul className="space-y-1.5 text-sm leading-snug">
                    {c.items.map((x, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-bold">{c.mark}</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>
        )}

        {content.sources.length > 0 && (
          <footer className="border-t pt-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Sources</p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {content.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    {hostOf(s.url)} <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </div>
    </article>
  );
}

// Meeting mode: one idea per screen, big type, swipe (or tap) through.
export function MeetingMode({ title, content, onClose }: { title: string; content: TopicCardContent; onClose: () => void }) {
  const slides: Array<{ label: string; body: React.ReactNode }> = [
    { label: "What you need to know", body: content.know },
    ...content.talkingPoints.map((t, i) => ({ label: `Talking point ${i + 1} of ${content.talkingPoints.length}`, body: t })),
    ...(content.pros.length || content.cons.length
      ? [
          {
            label: "Pros and cons",
            body: (
              <div className="space-y-4 text-xl">
                {content.pros.map((p, i) => (
                  <p key={`p${i}`}>
                    <span className="mr-2 font-bold text-emerald-300">+</span>
                    {p}
                  </p>
                ))}
                {content.cons.map((c, i) => (
                  <p key={`c${i}`}>
                    <span className="mr-2 font-bold text-red-300">–</span>
                    {c}
                  </p>
                ))}
              </div>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#14253D] text-white" role="dialog" aria-label={`Meeting mode: ${title}`} data-testid="meeting-mode">
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm font-semibold text-white/80">{title}</p>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
          Done
        </button>
      </div>
      <div className="flex flex-1 snap-x snap-mandatory overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {slides.map((s, i) => (
          <section key={i} className="flex w-full shrink-0 snap-center flex-col justify-center px-7 pb-16">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-[#6CC3EE]">{s.label}</p>
            <div className="text-2xl font-semibold leading-snug sm:text-3xl">{s.body}</div>
            <p className="mt-8 text-xs text-white/50">{i < slides.length - 1 ? "Swipe for next →" : "That's everything."}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
