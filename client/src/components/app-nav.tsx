import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Book,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Database,
  Eye,
  FolderOpen,
  House,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Megaphone,
  MonitorPlay,
  Newspaper,
  Rocket,
  ScrollText,
  Settings,
  Share2,
  Shield,
  MessageCircleQuestion,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { GaMark } from "@/components/ga-mark";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Navigation model ─────────────────────────────────────────────────────────

interface NavPage {
  title: string;
  url: string;
  icon: LucideIcon;
  tourId: string;
}

// One icon on the rail. A single page navigates on click; several pages open
// a floating menu (the page underneath stays put).
interface RailItem {
  key: string;
  label: string;
  icon: LucideIcon;
  pages: NavPage[];
}

interface RailGroup {
  label?: string; // shown as a divider label in the mobile menu
  items: RailItem[];
  /** Listed in the phone menu only (on desktop these live in the top bar). */
  mobileOnly?: boolean;
}

const page = (title: string, url: string, icon: LucideIcon, tourId: string): NavPage => ({ title, url, icon, tourId });

const CLIENT_GROUPS: RailGroup[] = [
  {
    label: "Today",
    items: [{ key: "today", label: "Today", icon: House, pages: [page("Today", "/dashboard", House, "dashboard")] }],
  },
  {
    // Desktop: these live in the top bar. Listed here for the phone menu.
    label: "Monitor",
    mobileOnly: true,
    items: [
      { key: "news", label: "News", icon: Newspaper, pages: [page("News", "/news", Newspaper, "news")] },
      { key: "press", label: "Press", icon: Megaphone, pages: [page("Press Releases", "/press-releases", Megaphone, "press-releases")] },
      { key: "markets", label: "Markets", icon: BarChart3, pages: [page("Prediction Markets", "/predictions", BarChart3, "predictions")] },
      {
        key: "worried",
        label: "Should I be worried?",
        icon: MessageCircleQuestion,
        pages: [page("Should I be worried?", "/briefs", MessageCircleQuestion, "briefs")],
      },
    ],
  },
  {
    label: "Reach",
    items: [
      {
        key: "people",
        label: "People",
        icon: Users,
        pages: [
          page("Contacts", "/contacts", Users, "contacts"),
          page("Your Clients", "/onboarding?step=clients", Building2, "firm-clients"),
          page("Staff Directory", "/staffers", Briefcase, "staffers"),
          page("Members of Congress", "/network", Landmark, "network"),
          page("Power Search", "/power-search", Zap, "power-search"),
          page("Client Portals", "/portals", Share2, "portals"),
        ],
      },
      { key: "strategy", label: "Strategy", icon: Target, pages: [page("Strategy Board", "/strategy", Target, "strategy")] },
      { key: "research", label: "Research", icon: FolderOpen, pages: [page("Research Projects", "/matters", FolderOpen, "matters")] },
    ],
  },
  {
    label: "Legislation",
    items: [
      {
        key: "bills",
        label: "Bills",
        icon: ScrollText,
        pages: [
          page("Tracked Bills", "/bills", ScrollText, "bills"),
          page("Bill Mapping", "/bill-mapping", MapPin, "bill-mapping"),
        ],
      },
      { key: "hearings", label: "Hearings", icon: CalendarDays, pages: [page("Hearings & Schedules", "/schedules", CalendarDays, "schedules")] },
    ],
  },
  {
    label: "Help",
    items: [{ key: "knowledge", label: "Help", icon: Book, pages: [page("Help Center", "/kb", Book, "kb")] }],
  },
];

// Pinned to the bottom of the rail.
const SETTINGS_ITEM: RailItem = {
  key: "settings",
  label: "Settings",
  icon: Settings,
  pages: [
    page("Settings", "/settings", Settings, "settings"),
    page("Sources", "/sources", Database, "sources"),
    page("Security", "/security", Lock, "security"),
  ],
};

const ADMIN_GROUPS: RailGroup[] = [
  {
    label: "Admin",
    items: [
      {
        key: "admin",
        label: "Admin",
        icon: Shield,
        pages: [
          page("Dashboard", "/admin", LayoutDashboard, "admin-dashboard"),
          page("Business Dev", "/admin/business-dev", Rocket, "admin-business-dev"),
          page("Applications", "/admin/applications", ClipboardList, "admin-applications"),
          page("Clients", "/admin/clients", Building2, "admin-clients"),
          page("Users", "/admin/users", Users, "admin-users"),
          page("Sources", "/sources", Database, "admin-sources"),
          page("Knowledge Base", "/admin/kb", Book, "admin-kb"),
          page("Tech Stack", "/admin/tech", Zap, "admin-tech"),
          page("Demo Videos", "/admin/demos", MonitorPlay, "admin-demos"),
          page("Demo Access Log", "/admin/demo-access", Eye, "admin-demo-access"),
          page("Security", "/admin/security", Lock, "admin-security"),
          page("Settings", "/admin/settings", Settings, "admin-settings"),
        ],
      },
    ],
  },
];

interface UserRole {
  isSuperAdmin: boolean;
  clientName?: string;
  role?: string;
  impersonatingClientId?: string;
  impersonatingClientName?: string;
}

function isActiveUrl(location: string, url: string) {
  return location === url || location.startsWith(url + "/");
}

// Longest matching URL wins, so "/admin/kb" doesn't count as "/admin".
function itemForLocation(items: RailItem[], location: string): string | null {
  let best: { key: string; len: number; single: boolean } | null = null;
  for (const item of items) {
    for (const p of item.pages) {
      if (!isActiveUrl(location, p.url)) continue;
      // Ties (a page listed under two icons, e.g. Client Portals) go to the
      // icon dedicated to that page.
      if (!best || p.url.length > best.len || (p.url.length === best.len && item.pages.length === 1 && !best.single)) {
        best = { key: item.key, len: p.url.length, single: item.pages.length === 1 };
      }
    }
  }
  return best?.key ?? null;
}

function useNavModel() {
  const { user, logout } = useAuth();
  const { data: userRole } = useQuery<UserRole>({ queryKey: ["/api/user/role"], enabled: !!user });

  const isSuperAdmin = !!userRole?.isSuperAdmin;
  const isImpersonating = isSuperAdmin && !!userRole?.impersonatingClientId;
  const isClientView = !isSuperAdmin || isImpersonating;

  const groups = isClientView ? CLIENT_GROUPS : ADMIN_GROUPS;
  const allItems = [...groups.filter((g) => !g.mobileOnly).flatMap((g) => g.items), ...(isClientView ? [SETTINGS_ITEM] : [])];
  const workspaceName = !isClientView
    ? "Platform admin"
    : (isImpersonating ? userRole?.impersonatingClientName : userRole?.clientName) || "";

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() || "U";
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || "User";
  const roleLabel = isSuperAdmin ? "Super admin" : userRole?.role || "Member";

  return { groups, allItems, isClientView, workspaceName, user, logout, initials, displayName, roleLabel };
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function PageLinks({ pages, location, onNavigate }: { pages: NavPage[]; location: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {pages.map((p) => {
        const active = isActiveUrl(location, p.url);
        return (
          <li key={p.url}>
            <Link
              href={p.url}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-testid={`nav-${p.tourId}`}
              data-tour={p.tourId}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <p.icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-muted-foreground"}`} />
              <span className="truncate">{p.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// Settings, Sources and Security, from the top bar.
export function SettingsMenu() {
  const { isClientView } = useNavModel();
  const [location] = useLocation();
  const pages = isClientView ? SETTINGS_ITEM.pages : [page("Settings", "/admin/settings", Settings, "admin-settings")];
  const active = pages.some((p) => isActiveUrl(location, p.url));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex h-9 w-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${
            active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Settings"
          title="Settings"
          data-testid="button-settings-menu"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {pages.map((p) => (
          <DropdownMenuItem key={p.url} asChild>
            <Link href={p.url} data-testid={`menu-${p.tourId}`}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.title}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UserMenu({ side = "bottom" }: { side?: "right" | "top" | "bottom" }) {
  const { user, logout, initials, displayName, roleLabel, workspaceName } = useNavModel();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Account menu"
          data-testid="button-user-menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {roleLabel}
            {workspaceName && <> · {workspaceName}</>}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings" data-testid="menu-settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} className="text-destructive" data-testid="menu-logout">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Desktop: icon rail + floating menus ─────────────────────────────────────

function RailButton({
  item,
  current,
  menuOpen,
  onOpenMenu,
}: {
  item: RailItem;
  current: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const hasMenu = item.pages.length > 1;
  const className = `flex w-[60px] flex-col items-center gap-1 rounded-lg py-1.5 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring/50 ${
    current
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : menuOpen
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
  const content = (
    <>
      <item.icon className="h-5 w-5" strokeWidth={current ? 2.1 : 1.75} />
      <span className={`text-[11px] leading-none ${current ? "font-semibold" : "font-medium"}`}>{item.label}</span>
    </>
  );

  if (!hasMenu) {
    const p = item.pages[0];
    return (
      <Link
        href={p.url}
        className={className}
        aria-current={current ? "page" : undefined}
        aria-label={p.title}
        title={p.title}
        data-testid={`nav-${p.tourId}`}
        data-tour={p.tourId}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenMenu}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      aria-label={item.label}
      className={className}
      data-testid={`nav-section-${item.key}`}
    >
      {content}
    </button>
  );
}

export function AppNav() {
  const [location] = useLocation();
  const { groups, allItems, isClientView, workspaceName } = useNavModel();
  const [menu, setMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  const currentItem = itemForLocation(allItems, location);
  const openItem = allItems.find((i) => i.key === menu) ?? null;

  // The menu floats over the page: picking a page, clicking away or Esc closes it.
  useEffect(() => setMenu(null), [location]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const toggle = (key: string) => setMenu(menu === key ? null : key);

  return (
    <nav ref={navRef} className="relative z-40 hidden h-full shrink-0 md:flex" aria-label="Main">
      {/* Rail */}
      <div className="flex w-[76px] flex-col items-center border-r border-foreground/15 bg-card">
        <Link
          href={isClientView ? "/dashboard" : "/admin"}
          title={workspaceName || "GovernmentAffairs.io"}
          className="mt-3 mb-2 shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GaMark size={34} />
        </Link>

        <div className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden py-1">
          {groups.filter((g) => !g.mobileOnly).map((g, gi) => (
            <div key={g.label ?? gi} className="flex w-full flex-col items-center gap-0.5">
              {gi > 0 && <div className="my-1.5 h-px w-10 bg-foreground/20" aria-hidden />}
              {g.items.map((item) => (
                <RailButton
                  key={item.key}
                  item={item}
                  current={currentItem === item.key}
                  menuOpen={menu === item.key}
                  onOpenMenu={() => toggle(item.key)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Settings and the account menu live in the top bar (top right). */}
      </div>

      {/* Floating menu — overlays the page instead of pushing it */}
      {openItem && (
        <div
          role="menu"
          aria-label={openItem.label}
          className="absolute left-[76px] top-0 flex h-full w-60 flex-col border-r border-foreground/15 bg-card shadow-xl animate-in fade-in-0 slide-in-from-left-2 duration-150"
        >
          <div className="px-4 pb-3 pt-4">
            <p className="text-[15px] font-bold tracking-tight">{openItem.label}</p>
            {workspaceName && <p className="truncate text-xs text-muted-foreground">{workspaceName}</p>}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <PageLinks pages={openItem.pages} location={location} onNavigate={() => setMenu(null)} />
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Mobile: full menu in a sheet ─────────────────────────────────────────────

export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [location] = useLocation();
  const { groups, isClientView, workspaceName, displayName, roleLabel } = useNavModel();
  const close = () => onOpenChange(false);
  const listed = new Set<string>();
  const sections = [
    ...groups.map((g) => ({ label: g.label ?? "", pages: g.items.flatMap((i) => i.pages) })),
    ...(isClientView ? [{ label: "Settings", pages: SETTINGS_ITEM.pages }] : []),
  ]
    .map((sec) => ({
      ...sec,
      pages: sec.pages.filter((p) => (listed.has(p.url) ? false : (listed.add(p.url), true))),
    }))
    .filter((sec) => sec.pages.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex items-center gap-2.5 border-b px-4 py-4">
          <GaMark size={30} />
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-bold tracking-tight">
              GovernmentAffairs<span className="text-[#078ACB]">.io</span>
            </p>
            {workspaceName && <p className="truncate text-xs text-muted-foreground">{workspaceName}</p>}
          </div>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {sections.map((s) => (
            <div key={s.label}>
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {s.label}
              </p>
              <PageLinks pages={s.pages} location={location} onNavigate={close} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <UserMenu side="top" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
