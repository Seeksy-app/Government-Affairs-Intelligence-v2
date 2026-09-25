import { useState } from "react";
import { Check, Info, Plus, X } from "lucide-react";
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
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  testId?: string;
  /** Small marker after a label, e.g. which agencies have press feeds. */
  badge?: (value: string) => React.ReactNode;
}) {
  const set = new Set(value.map((v) => v.toLowerCase()));
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
