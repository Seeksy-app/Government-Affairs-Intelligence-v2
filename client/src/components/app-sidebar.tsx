import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GaMark } from "@/components/ga-mark";
import { Building2, Users, Newspaper, LayoutDashboard, Settings, ChevronsUpDown, LogOut, FolderOpen, Book, Lock, Share2, Database, ClipboardList, BarChart3, Briefcase, Calendar, Rocket, Zap, MapPin, Target, Landmark, ScrollText, MonitorPlay, Eye, Radio, Sunrise, ShieldQuestion } from "lucide-react";

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  role?: string;
  impersonatingClientId?: string;
  impersonatingClientName?: string;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

  const isSuperAdmin = userRole?.isSuperAdmin;
  const isImpersonating = isSuperAdmin && userRole?.impersonatingClientId;

  const superAdminItems = [
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
  ];

  // Client navigation — flat sections named for the jobs lobbyists do
  // (brand verbs: monitor, brief, reach). Every page appears exactly once;
  // off-thesis modules (sports, marketing, social, local gov) stay unlisted.
  const clientSections: Array<{
    label?: string;
    items: Array<{ title: string; url: string; icon: typeof LayoutDashboard; tourId: string }>;
  }> = [
    {
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tourId: "dashboard" },
        { title: "Morning Brief", url: "/morning-brief", icon: Sunrise, tourId: "morning-brief" },
      ],
    },
    {
      label: "Brief",
      items: [
        { title: "Should I be worried?", url: "/briefs", icon: ShieldQuestion, tourId: "briefs" },
        { title: "Research Projects", url: "/matters", icon: FolderOpen, tourId: "matters" },
        { title: "Knowledge Base", url: "/kb", icon: Book, tourId: "kb" },
      ],
    },
    {
      label: "Monitor",
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
      label: "Reach",
      items: [
        { title: "Staff Directory", url: "/staffers", icon: Briefcase, tourId: "staffers" },
        { title: "Members of Congress", url: "/network", icon: Landmark, tourId: "network" },
        { title: "Contacts", url: "/contacts", icon: Users, tourId: "contacts" },
        { title: "Power Search", url: "/power-search", icon: Zap, tourId: "power-search" },
        { title: "Strategy Board", url: "/strategy", icon: Target, tourId: "strategy" },
      ],
    },
    {
      label: "Clients",
      items: [
        { title: "Client Portals", url: "/portals", icon: Share2, tourId: "portals" },
      ],
    },
    {
      label: "Workspace",
      items: [
        { title: "Sources", url: "/sources", icon: Database, tourId: "sources" },
        { title: "Security", url: "/security", icon: Lock, tourId: "security" },
        { title: "Settings", url: "/settings", icon: Settings, tourId: "settings" },
      ],
    },
  ];

  const isActive = (url: string) => location === url || location.startsWith(url + "/");

  const isClientView = !isSuperAdmin || isImpersonating;
  const workspaceName = (isSuperAdmin && !isImpersonating)
    ? "Platform admin"
    : (isImpersonating ? userRole?.impersonatingClientName : userRole?.clientName) || "";

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  const getDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || "User";
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <GaMark size={30} />
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-bold tracking-tight text-sidebar-foreground">
              GovernmentAffairs<span className="text-[#078ACB]">.io</span>
            </p>
            <p className="truncate text-xs text-muted-foreground" data-testid="text-workspace-name">
              {workspaceName}
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0 pb-2">
        {isClientView ? (
          clientSections.map((section, i) => (
            <SidebarGroup key={section.label ?? i} className="py-1">
              {section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link
                          href={item.url}
                          data-testid={`nav-${item.tourId}`}
                          data-tour={item.tourId}
                        >
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))
        ) : (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        data-tour={item.tourId}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold truncate">{getDisplayName()}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {isSuperAdmin ? "Super Admin" : userRole?.role || "Member"}
                </p>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings" data-testid="menu-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logout()}
              className="text-destructive"
              data-testid="menu-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
