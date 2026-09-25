import { useRef, useState } from "react";
import { Check, Info, Loader2, Plus, Sparkles, Undo2, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Opt } from "@shared/onboarding";

// Building blocks for the onboarding questions. Large tap targets, one clear
// selected state (Signal Blue), and a "why we ask" line under every question.

export function Question({
  title,
  subtitle,
  why,
  children,
}: {
  title: string;
  subtitle?: string;
  why?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-9 last:mb-0">
      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
      {why && <WhyWeAsk>{why}</WhyWeAsk>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function WhyWeAsk({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-[#078ACB] dark:text-[#6CC3EE]">
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-semibold">Why we ask: </span>
        {children}
      </span>
    </p>
  );
}

// Single choice as cards with an optional hint line.
export function ChoiceCards<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  testId,
}: {
  options: Opt<T>[];
  value: T | undefined | null;
  onChange: (v: T) => void;
  columns?: 1 | 2 | 3;
  testId?: string;
}) {
  const cols = columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "";
  return (
    <div role="radiogroup" className={`grid gap-2.5 ${cols}`} data-testid={testId}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078ACB]/50 ${
              on
                ? "border-[#078ACB] bg-[#078ACB]/[0.06] shadow-sm ring-1 ring-[#078ACB]"
                : "border-border bg-card hover:border-[#078ACB]/50 hover:bg-muted/40"
            }`}
            data-testid={testId ? `${testId}-${o.value}` : undefined}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                on ? "border-[#078ACB] bg-[#078ACB] text-white" : "border-muted-foreground/40"
              }`}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold leading-snug">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Multi-select pills.
export function ChipPicker({
  options,
  value,
  onChange,
  testId,
  badge,
  allowCustom,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  testId?: string;
  /** Small marker after a label, e.g. which agencies have press feeds. */
  badge?: (value: string) => React.ReactNode;
  /** Adds an "Add your own" pill; custom entries show as selected pills. */
  allowCustom?: string;
}) {
  const [draft, setDraft] = useState("");
  const set = new Set(value.map((v) => v.toLowerCase()));
  const known = new Set(options.map((o) => o.value.toLowerCase()));
  const custom = allowCustom ? value.filter((v) => !known.has(v.toLowerCase())) : [];
  const addCustom = () => {
    const t = draft.trim().slice(0, 120);
    if (t && !set.has(t.toLowerCase())) onChange([...value, t]);
    setDraft("");
  };
  const toggle = (v: string) =>
    onChange(set.has(v.toLowerCase()) ? value.filter((x) => x.toLowerCase() !== v.toLowerCase()) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((o) => {
        const on = set.has(o.value.toLowerCase());
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#078ACB]/50 ${
              on
                ? "border-[#078ACB] bg-[#078ACB] text-white"
                : "border-border bg-card text-foreground hover:border-[#078ACB]/50"
            }`}
          >
            {on && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {o.label}
            {badge?.(o.value)}
          </button>
        );
      })}
      {custom.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#078ACB] bg-[#078ACB] py-1.5 pl-3.5 pr-2 text-sm font-medium text-white"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${v}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      {allowCustom && (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-card pl-3 pr-1 focus-within:border-[#078ACB]">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addCustom();
              }
            }}
            onBlur={addCustom}
            placeholder={allowCustom}
            className="w-40 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            data-testid={testId ? `${testId}-custom` : undefined}
          />
        </span>
      )}
    </div>
  );
}

// Free-form tags: type and press Enter (or comma). Custom entries the chip
// lists don't cover ("overtime rule", "TRICARE", "Senate Aging").
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  testId,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  testId?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, "").slice(0, 120);
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
  return (
    <div>
      <div className="flex min-h-[48px] flex-wrap items-center gap-1.5 rounded-xl border bg-card px-2.5 py-2 focus-within:border-[#078ACB] focus-within:ring-2 focus-within:ring-[#078ACB]/20">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-[#14253D] py-1 pl-3 pr-1.5 text-sm font-medium text-white dark:bg-white/15">
            {v}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="rounded-full p-0.5 hover:bg-white/20"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? "Add another…" : placeholder}
          className="min-w-[180px] flex-1 bg-transparent px-1.5 py-1 text-[15px] outline-none placeholder:text-muted-foreground"
          data-testid={testId}
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Examples:</span>
          {unused.slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-[#078ACB] hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <p className="text-sm font-semibold">{children}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export type AssistField = "business" | "goals" | "relationship" | "friction" | "avoid";
type AssistAction = "draft" | "shorter" | "longer" | "polish";

// A textarea with a writing-help menu: draft it, shorten, lengthen, polish.
// The result replaces the text in place, with one-step undo.
export function AssistTextarea({
  field,
  value,
  onChange,
  context,
  testId,
  className,
  ...props
}: {
  field: AssistField;
  value: string;
  onChange: (v: string) => void;
  context: { clientName: string; business: string; industries: string[] };
  testId?: string;
} & Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange">) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<AssistAction | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  // Latest text, so a slow response never overwrites what was typed meanwhile.
  const latest = useRef(value);
  latest.current = value;
  const empty = !value.trim();

  const run = async (action: AssistAction) => {
    setBusy(action);
    const sent = value;
    try {
      const res = await apiRequest("POST", "/api/onboarding/assist", { field, action, text: sent, ...context });
      const { text } = (await res.json()) as { text: string };
      if (latest.current !== sent) return; // edited while waiting: keep the edit
      setPrevious(sent);
      onChange(text);
    } catch (err) {
      toast({ title: "Writing help didn't work", description: friendlyError(err as Error), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const items: Array<{ action: AssistAction; label: string; hint: string; needsText: boolean }> = [
    { action: "draft", label: empty ? "Write a draft for me" : "Start over with a draft", hint: "Leaves [blanks] for facts only you know", needsText: false },
    { action: "polish", label: "Polish the wording", hint: "Same meaning, cleaner", needsText: true },
    { action: "shorter", label: "Make it shorter", hint: "Keep the facts, cut the rest", needsText: true },
    { action: "longer", label: "Make it longer", hint: "Add useful detail", needsText: true },
  ];

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => {
          setPrevious(null); // Undo only restores an untouched result
          onChange(e.target.value);
        }}
        className={cn("text-[15px]", className, "pr-12")}
        data-testid={testId}
        {...props}
      />
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {previous !== null && !busy && (
          <button
            type="button"
            onClick={() => {
              onChange(previous);
              setPrevious(null);
            }}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Undo"
            aria-label="Undo writing help"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!!busy}
              className="rounded-md bg-[#078ACB]/10 p-1.5 text-[#078ACB] transition-colors hover:bg-[#078ACB]/20 disabled:opacity-70 dark:text-[#6CC3EE]"
              title="Writing help"
              aria-label="Writing help"
              data-testid={testId ? `${testId}-assist` : undefined}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Writing help</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {items.map((it) => (
              <DropdownMenuItem
                key={it.action}
                disabled={it.needsText && empty}
                onSelect={() => run(it.action)}
                className="flex flex-col items-start gap-0"
              >
                <span className="font-medium">{it.label}</span>
                <span className="text-xs text-muted-foreground">{it.hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
