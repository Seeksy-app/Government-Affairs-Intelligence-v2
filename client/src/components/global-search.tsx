import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Briefcase,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  Newspaper,
  ScrollText,
  Search,
  Settings,
  Share2,
  Sunrise,
  Target,
  Users,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}
interface SearchGroup {
  type: "bills" | "staffers" | "contacts" | "projects" | "briefs" | "portals";
  label: string;
  items: SearchItem[];
}

const GROUP_ICONS: Record<SearchGroup["type"], LucideIcon> = {
  bills: ScrollText,
  staffers: Briefcase,
  contacts: Users,
  projects: FolderOpen,
  briefs: FileText,
  portals: Share2,
};

// Jump-to pages, matched on the client (no server round trip).
const PAGES: Array<{ title: string; href: string; icon: LucideIcon; keywords: string }> = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: "home overview" },
  { title: "Bill Tracking", href: "/bills", icon: ScrollText, keywords: "bills legislation track state federal" },
  { title: "Contacts", href: "/contacts", icon: Users, keywords: "people network lists" },
  { title: "Staffer Directory", href: "/staffers", icon: Briefcase, keywords: "staff legistorm congress directory" },
  { title: "Morning Brief", href: "/morning-brief", icon: Sunrise, keywords: "news brief today" },
  { title: "Decision Briefs", href: "/briefs", icon: FileText, keywords: "brief worried research answer" },
  { title: "Research Projects", href: "/matters", icon: FolderOpen, keywords: "matters projects research" },
  { title: "Strategy Board", href: "/strategy", icon: Target, keywords: "pipeline path finder access map" },
  { title: "Client Portals", href: "/portals", icon: Share2, keywords: "clients portal share" },
  { title: "News", href: "/news", icon: Newspaper, keywords: "articles press" },
  { title: "Prediction Markets", href: "/predictions", icon: BarChart3, keywords: "kalshi markets odds" },
  { title: "Settings", href: "/settings", icon: Settings, keywords: "account profile" },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [, navigate] = useLocation();
  const debounced = useDebounced(query.trim(), 250);

  // ⌘K / Ctrl+K anywhere opens (or closes) search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const { data, isFetching } = useQuery<{ groups: SearchGroup[] }>({
    queryKey: ["/api/search", debounced],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES.slice(0, 6);
    return PAGES.filter((p) => `${p.title} ${p.keywords}`.toLowerCase().includes(q)).slice(0, 4);
  }, [query]);

  const groups = debounced.length >= 2 ? data?.groups ?? [] : [];
  const waiting = query.trim().length >= 2 && (isFetching || debounced !== query.trim());

  const go = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-muted/60 transition-colors"
        data-testid="button-global-search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search bills, staff, contacts…</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          {/* Results are already filtered server-side, so cmdk must not re-filter. */}
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <div className="relative">
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Search bills, congressional staff, contacts, projects, briefs…"
                data-testid="input-global-search"
              />
              {waiting && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <CommandList className="max-h-[60vh]">
              {query.trim().length >= 2 && !waiting && groups.length === 0 && pages.length === 0 && (
                <CommandEmpty>No results for "{query.trim()}".</CommandEmpty>
              )}

              {groups.map((group, i) => {
                const Icon = GROUP_ICONS[group.type];
                return (
                  <div key={group.type}>
                    {i > 0 && <CommandSeparator />}
                    <CommandGroup heading={group.label}>
                      {group.items.map((item) => (
                        <CommandItem
                          key={`${group.type}-${item.id}`}
                          value={`${group.type}-${item.id}`}
                          onSelect={() => go(item.href)}
                          className="gap-3"
                          data-testid={`search-result-${group.type}-${item.id}`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate">{item.title}</p>
                            {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                );
              })}

              {pages.length > 0 && (
                <>
                  {groups.length > 0 && <CommandSeparator />}
                  <CommandGroup heading="Go to">
                    {pages.map((page) => (
                      <CommandItem key={page.href} value={`page-${page.href}`} onSelect={() => go(page.href)} className="gap-3">
                        <page.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {page.title}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
