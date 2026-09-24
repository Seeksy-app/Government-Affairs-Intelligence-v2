import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Book,
  Briefcase,
  Building2,
  Calendar,
  ChevronsLeft,
  ClipboardList,
  Database,
  Eye,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  MonitorPlay,
  Newspaper,
  Radar,
  Radio,
  Rocket,
  Route,
  ScrollText,
  Settings,
  Share2,
  Shield,
  ShieldQuestion,
  Sunrise,
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

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  tourId: string;
}

interface NavSection {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

// Sections are named for the jobs lobbyists do (brand verbs). Every page
// appears exactly once; off-thesis modules stay unlisted.
const CLIENT_SECTIONS: NavSection[] = [
  {
    key: "home",
    label: "Home",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tourId: "dashboard" },
      { title: "Morning Brief", url: "/morning-brief", icon: Sunrise, tourId: "morning-brief" },
    ],
  },
  {
    key: "brief",
    label: "Brief",
    icon: ShieldQuestion,
    items: [
      { title: "Should I be worried?", url: "/briefs", icon: ShieldQuestion, tourId: "briefs" },
      { title: "Research Projects", url: "/matters", icon: FolderOpen, tourId: "matters" },
      { title: "Knowledge Base", url: "/kb", icon: Book, tourId: "kb" },
    ],
  },
  {
    key: "monitor",
    label: "Monitor",
    icon: Radar,
    items: [
      { title: "Bills", url: "/bills", icon: ScrollText, tourId: "bills" },
      { title: "Hearings & Schedules", url: "/schedules", icon: Calendar, tourId: "schedules" },
      { title: "Bill Mapping", url: "/bill-mapping", icon: MapPin, tourId: "bill-mapping" },
      { title: "News", url: "/news", icon: Newspaper, tourId: "news" },
      { title: "Press Releases", url: "/press-releases", icon: Radio, tourId: "press-releases" },
      { title: "Prediction Markets", url: "/predictions", icon: BarChart3, tourId: "predictions" },
    ],
  },
  {
    key: "reach",
    label: "Reach",
    icon: Route,
    items: [
      { title: "Staff Directory", url: "/staffers", icon: Briefcase, tourId: "staffers" },
      { title: "Members of Congress", url: "/network", icon: Landmark, tourId: "network" },
      { title: "Contacts", url: "/contacts", icon: Users, tourId: "contacts" },
      { title: "Power Search", url: "/power-search", icon: Zap, tourId: "power-search" },
      { title: "Strategy Board", url: "/strategy", icon: Target, tourId: "strategy" },
    ],
  },
  {
    key: "clients",
    label: "Clients",
    icon: Share2,
    items: [{ title: "Client Portals", url: "/portals", icon: Share2, tourId: "portals" }],
  },
];

// Lives at the bottom of the rail (gear), not with the job sections.
const WORKSPACE_SECTION: NavSection = {
  key: "workspace",
  label: "Workspace",
  icon: Settings,
  items: [
    { title: "Sources", url: "/sources", icon: Database, tourId: "sources" },
    { title: "Security", url: "/security", icon: Lock, tourId: "security" },
    { title: "Settings", url: "/settings", icon: Settings, tourId: "settings" },
  ],
};

const ADMIN_SECTION: NavSection = {
  key: "admin",
  label: "Admin",
  icon: Shield,
  items: [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard, tourId: "admin-dashboard" },
    { title: "Business Dev", url: "/admin/business-dev", icon: Rocket, tourId: "admin-business-dev" },
    { title: "Applications", url: "/admin/applications", icon: ClipboardList, tourId: "admin-applications" },
    { title: "Clients", url: "/admin/clients", icon: Building2, tourId: "admin-clients" },
    { title: "Users", url: "/admin/users", icon: Users, tourId: "admin-users" },
    { title: "Sources", url: "/sources", icon: Database, tourId: "admin-sources" },
    { title: "Knowledge Base", url: "/admin/kb", icon: Book, tourId: "admin-kb" },
    { title: "Tech Stack", url: "/admin/tech", icon: Zap, tourId: "admin-tech" },
    { title: "Demo Videos", url: "/admin/demos", icon: MonitorPlay, tourId: "admin-demos" },
    { title: "Demo Access Log", url: "/admin/demo-access", icon: Eye, tourId: "admin-demo-access" },
    { title: "Security", url: "/admin/security", icon: Lock, tourId: "admin-security" },
    { title: "Settings", url: "/admin/settings", icon: Settings, tourId: "admin-settings" },
  ],
};

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
function sectionForLocation(sections: NavSection[], location: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const s of sections) {
    for (const item of s.items) {
      if (isActiveUrl(location, item.url) && (!best || item.url.length > best.len)) {
        best = { key: s.key, len: item.url.length };
      }
    }
  }
  return best?.key ?? null;
}

const PANEL_KEY = "ga-nav-panel";

function readPanel(): string | null | undefined {
  try {
    const v = localStorage.getItem(PANEL_KEY);
    if (v === null) return undefined; // never set → default open
    return v === "closed" ? null : v;
  } catch {
    return undefined;
  }
}

function writePanel(v: string | null) {
  try {
    localStorage.setItem(PANEL_KEY, v ?? "closed");
  } catch {
    // Private mode etc. — the panel just won't remember its state.
  }
}

function useNavModel() {
  const { user, logout } = useAuth();
  const { data: userRole } = useQuery<UserRole>({ queryKey: ["/api/user/role"], enabled: !!user });

  const isSuperAdmin = !!userRole?.isSuperAdmin;
  const isImpersonating = isSuperAdmin && !!userRole?.impersonatingClientId;
  const isClientView = !isSuperAdmin || isImpersonating;

  const sections = isClientView ? CLIENT_SECTIONS : [ADMIN_SECTION];
  const all = isClientView ? [...CLIENT_SECTIONS, WORKSPACE_SECTION] : [ADMIN_SECTION];
  const workspaceName = !isClientView
    ? "Platform admin"
    : (isImpersonating ? userRole?.impersonatingClientName : userRole?.clientName) || "";

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.email?.[0]?.toUpperCase() || "U";
  const displayName = user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || "User";
  const roleLabel = isSuperAdmin ? "Super admin" : userRole?.role || "Member";

  return { sections, all, isClientView, workspaceName, user, logout, initials, displayName, roleLabel };
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function NavLinks({ section, location, onNavigate }: { section: NavSection; location: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {section.items.map((item) => {
        const active = isActiveUrl(location, item.url);
        return (
          <li key={item.url}>
            <Link
              href={item.url}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              data-testid={`nav-${item.tourId}`}
              data-tour={item.tourId}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${active ? "" : "text-muted-foreground"}`} />
              <span className="truncate">{item.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UserMenu({ side = "right" }: { side?: "right" | "top" }) {
  const { user, logout, initials, displayName, roleLabel, workspaceName } = useNavModel();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring"
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

// ─── Desktop: icon rail + flyout panel ───────────────────────────────────────

function RailButton({
  section,
  open,
  current,
  onClick,
}: {
  section: NavSection;
  open: boolean;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="nav-flyout"
      aria-label={section.label}
      data-testid={`nav-section-${section.key}`}
      className={`group flex w-14 flex-col items-center gap-1 rounded-lg py-2 transition-colors ${
        open
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : current
            ? "text-primary hover:bg-muted"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <section.icon className="h-5 w-5" strokeWidth={current || open ? 2.1 : 1.75} />
      <span className={`text-[11px] leading-none ${current || open ? "font-semibold" : "font-medium"}`}>{section.label}</span>
    </button>
  );
}

export function AppNav() {
  const [location] = useLocation();
  const { sections, all, isClientView, workspaceName } = useNavModel();

  const currentSection = sectionForLocation(all, location);
  const [panel, setPanelState] = useState<string | null>(() => {
    const saved = readPanel();
    return saved === undefined ? currentSection ?? "home" : saved;
  });
  const setPanel = (v: string | null) => {
    setPanelState(v);
    writePanel(v);
  };

  // While the panel is open it follows you: navigating (sidebar, search,
  // in-page links) into another section shows that section's pages.
  useEffect(() => {
    if (panel && currentSection && currentSection !== panel) setPanelState(currentSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ⌘\ / Ctrl+\ toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setPanel(panel ? null : currentSection ?? sections[0].key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const openSection = all.find((s) => s.key === panel) ?? null;
  const toggle = (key: string) => setPanel(panel === key ? null : key);

  return (
    <nav className="hidden h-full shrink-0 md:flex" aria-label="Main">
      {/* Rail */}
      <div className="flex w-[72px] flex-col items-center border-r bg-card py-3">
        <Link href={isClientView ? "/dashboard" : "/admin"} title={workspaceName || "GovernmentAffairs.io"} className="mb-3 rounded-lg">
          <GaMark size={34} />
        </Link>
        <div className="flex flex-col items-center gap-1">
          {sections.map((s) => (
            <RailButton
              key={s.key}
              section={s}
              open={panel === s.key}
              current={currentSection === s.key}
              onClick={() => toggle(s.key)}
            />
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-2">
          {isClientView && (
            <RailButton
              section={WORKSPACE_SECTION}
              open={panel === WORKSPACE_SECTION.key}
              current={currentSection === WORKSPACE_SECTION.key}
              onClick={() => toggle(WORKSPACE_SECTION.key)}
            />
          )}
          <UserMenu />
        </div>
      </div>

      {/* Flyout panel — stays open while you work in that section */}
      {openSection && (
        <div
          id="nav-flyout"
          className="flex w-60 flex-col border-r bg-card animate-in fade-in-0 slide-in-from-left-2 duration-150"
        >
          <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight">{openSection.label}</p>
              {workspaceName && <p className="truncate text-xs text-muted-foreground">{workspaceName}</p>}
            </div>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Collapse menu"
              title="Collapse menu (⌘\)"
              data-testid="button-collapse-nav"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <NavLinks section={openSection} location={location} />
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Mobile: full menu in a sheet ─────────────────────────────────────────────

export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [location] = useLocation();
  const { all, workspaceName } = useNavModel();
  const close = () => onOpenChange(false);

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
          {all.map((s) => (
            <div key={s.key}>
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {s.label}
              </p>
              <NavLinks section={s} location={location} onNavigate={close} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t px-4 py-3">
          <UserMenu side="top" />
          <MobileUserName />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MobileUserName() {
  const { displayName, roleLabel } = useNavModel();
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{displayName}</p>
      <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
    </div>
  );
}
