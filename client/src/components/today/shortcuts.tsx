import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  FolderOpen,
  Landmark,
  MapPin,
  Megaphone,
  Newspaper,
  Pencil,
  ScrollText,
  Share2,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFirmSetup } from "@/hooks/use-firm-setup";
import { MAX_SHORTCUTS } from "@shared/onboarding";

// Pages a firm can pin to Today. Keys are stored in client_profiles.onboarding.shortcuts.
const SHORTCUTS: Array<{ key: string; label: string; href: string; icon: LucideIcon }> = [
  { key: "staffers", label: "Staff Directory", href: "/staffers", icon: Briefcase },
  { key: "bills", label: "Tracked Bills", href: "/bills", icon: ScrollText },
  { key: "hearings", label: "Hearings", href: "/schedules", icon: CalendarDays },
  { key: "contacts", label: "Contacts", href: "/contacts", icon: Users },
  { key: "members", label: "Members of Congress", href: "/network", icon: Landmark },
  { key: "clients", label: "Your Clients", href: "/onboarding?step=clients", icon: Building2 },
  { key: "power-search", label: "Power Search", href: "/power-search", icon: Zap },
  { key: "strategy", label: "Strategy Board", href: "/strategy", icon: Target },
  { key: "research", label: "Research Projects", href: "/matters", icon: FolderOpen },
  { key: "bill-mapping", label: "Bill Mapping", href: "/bill-mapping", icon: MapPin },
  { key: "portals", label: "Client Portals", href: "/portals", icon: Share2 },
  { key: "news", label: "News", href: "/news", icon: Newspaper },
  { key: "press", label: "Press Releases", href: "/press-releases", icon: Megaphone },
  { key: "markets", label: "Prediction Markets", href: "/predictions", icon: BarChart3 },
];
const DEFAULT_SHORTCUTS = ["staffers", "bills", "hearings"];
const MAX = MAX_SHORTCUTS;

// A row of the firm's favorite pages, right under "Should I be worried?".
export function Shortcuts() {
  const { data: setup } = useFirmSetup();
  const [open, setOpen] = useState(false);
  // Unknown keys (renamed or removed pages) are ignored, so they never use up a slot.
  const chosen = (setup?.profile?.onboarding?.shortcuts ?? DEFAULT_SHORTCUTS).filter((k) => SHORTCUTS.some((s) => s.key === k));

  const save = useMutation({
    // One at a time, in click order, so an older save can't land last.
    scope: { id: "today-shortcuts" },
    mutationFn: async (shortcuts: string[]) => apiRequest("PUT", "/api/onboarding/firm", { onboarding: { shortcuts } }),
    onMutate: (shortcuts) => {
      // Show the change immediately; the refetch confirms it.
      queryClient.setQueryData(["/api/onboarding"], (old: typeof setup) =>
        old?.profile ? { ...old, profile: { ...old.profile, onboarding: { ...old.profile.onboarding, shortcuts } } } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] }),
  });

  if (!setup?.profile) return null;
  const items = chosen.map((k) => SHORTCUTS.find((s) => s.key === k)).filter((s): s is (typeof SHORTCUTS)[number] => !!s);
  const toggle = (key: string) =>
    save.mutate(chosen.includes(key) ? chosen.filter((k) => k !== key) : [...chosen, key].slice(0, MAX));

  return (
    <section className="mb-8" data-testid="section-shortcuts">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Shortcuts</h2>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              data-testid="button-edit-shortcuts"
            >
              <Pencil className="h-3 w-3" /> Customize
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-2">
            <p className="px-2 pb-1 pt-1 text-sm font-semibold">Pin up to {MAX} pages to Today</p>
            <div className="max-h-80 overflow-y-auto">
              {SHORTCUTS.map((s) => {
                const on = chosen.includes(s.key);
                const full = !on && chosen.length >= MAX;
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={full}
                    onClick={() => toggle(s.key)}
                    aria-pressed={on}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-40"
                    data-testid={`shortcut-option-${s.key}`}
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                        on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      }`}
                    >
                      {on && "✓"}
                    </span>
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          Pin the pages you use most, like the Staff Directory or Tracked Bills.
        </button>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
          {items.map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className="group flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-sm font-semibold shadow-sm transition-colors hover:border-primary/40"
              data-testid={`shortcut-${s.key}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <s.icon className="h-4 w-4" />
              </span>
              <span className="leading-tight group-hover:text-primary">{s.label}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
