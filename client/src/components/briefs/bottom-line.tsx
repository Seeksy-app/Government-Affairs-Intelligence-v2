import type { ReactNode } from "react";
import { ShieldAlert, ShieldCheck, Eye } from "lucide-react";
import type { ConcernLevel } from "@shared/schema";

const LEVELS: Record<ConcernLevel, { label: string; icon: typeof Eye; box: string; pill: string }> = {
  low: {
    label: "Low concern",
    icon: ShieldCheck,
    box: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  },
  watch: {
    label: "Worth watching",
    icon: Eye,
    box: "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  },
  act: {
    label: "Act now",
    icon: ShieldAlert,
    // Civic Red (#A53B39) — the brand's one alarm color.
    box: "border-[#A53B39]/30 bg-[#A53B39]/5 dark:border-[#A53B39]/50 dark:bg-[#A53B39]/15",
    pill: "bg-[#A53B39] text-white",
  },
};

// The "Should I be worried?" answer, shown above the rest of the brief.
export function BottomLine({ level, children }: { level: ConcernLevel; children: ReactNode }) {
  const meta = LEVELS[level] ?? LEVELS.watch;
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border p-4 ${meta.box}`} data-testid="card-bottom-line">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bottom line
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.pill}`}>
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      </div>
      <p className="text-[15px] leading-relaxed font-medium">{children}</p>
    </div>
  );
}
