import { useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Users, Network, Newspaper, LayoutDashboard, Settings, ChevronUp, ChevronRight, LogOut, Shield, FolderOpen, Book, Lock, Share2, Bot, Database, ClipboardList, FileText, BarChart3, AtSign, UserCircle, Briefcase, Search, TrendingUp, Megaphone, Calendar, Rocket, Zap, MapPin, Target, Landmark, ScrollText, Globe, Crosshair, Trophy, Puzzle } from "lucide-react";

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

  const effectiveClientId = isImpersonating ? userRole?.impersonatingClientId : userRole?.clientId;

  const { data: sportsModuleCheck } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/modules/check/sports"],
    enabled: !!user && !!effectiveClientId,
  });

  const hasSportsModule = sportsModuleCheck?.enabled === true;

  const { data: marketingModuleCheck } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/modules/check/marketing_intelligence"],
    enabled: !!user && !!effectiveClientId,
  });

  const hasMarketingModule = marketingModuleCheck?.enabled === true;

  const superAdminItems = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard, tourId: "admin-dashboard" },
    { title: "Business Dev", url: "/admin/business-dev", icon: Rocket, tourId: "admin-business-dev" },
    { title: "Applications", url: "/admin/applications", icon: ClipboardList, tourId: "admin-applications" },
    { title: "Clients", url: "/admin/clients", icon: Building2, tourId: "admin-clients" },
    { title: "Users", url: "/admin/users", icon: Users, tourId: "admin-users" },
    { title: "Sources", url: "/sources", icon: Database, tourId: "admin-sources" },
    { title: "Knowledge Base", url: "/admin/kb", icon: Book, tourId: "admin-kb" },
    { title: "Tech Stack", url: "/admin/tech", icon: Zap, tourId: "admin-tech" },
    { title: "Security", url: "/admin/security", icon: Lock, tourId: "admin-security" },
    { title: "Settings", url: "/admin/settings", icon: Settings, tourId: "admin-settings" },
  ];

  const clientTopItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tourId: "dashboard" },
    { title: "Client Portals", url: "/portals", icon: Share2, tourId: "portals" },
  ];

  const clientDirectoryGroup = {
    label: "Gov Affairs",
    icon: Landmark,
    items: [
      { title: "Contacts", url: "/contacts", icon: Users, tourId: "contacts" },
      { title: "Staffers", url: "/staffers", icon: Briefcase, tourId: "staffers" },
      { title: "Members", url: "/network", icon: Landmark, tourId: "network" },
      { title: "Power Search", url: "/power-search", icon: Zap, tourId: "power-search" },
    ],
  };

  const clientLegislativeGroup = {
    label: "Legislative",
    icon: Landmark,
    items: [
      { title: "Bills", url: "/bills", icon: ScrollText, tourId: "bills" },
      { title: "Bill Mapping", url: "/bill-mapping", icon: MapPin, tourId: "bill-mapping" },
      { title: "Schedules", url: "/schedules", icon: Calendar, tourId: "schedules" },
    ],
  };

  const clientNewsGroup = {
    label: "News & Markets",
    icon: Globe,
    items: [
      { title: "News", url: "/news", icon: Newspaper, tourId: "news" },
      { title: "Predictions", url: "/predictions", icon: BarChart3, tourId: "predictions" },
      { title: "Rank Tracking", url: "/rank-tracking", icon: Search, tourId: "rank-tracking" },
    ],
  };

  const clientStrategyGroup = {
    label: "Strategy",
    icon: Crosshair,
    items: [
      { title: "Strategy Board", url: "/strategy", icon: Target, tourId: "strategy" },
      { title: "Knowledge Base", url: "/kb", icon: Book, tourId: "kb" },
      { title: "AI Agent", url: "/ai-agent", icon: Bot, tourId: "ai-agent" },
    ],
  };

  const clientSocialGroup = {
    label: "Social Media",
    icon: Megaphone,
    items: [
      { title: "Social Tracking", url: "/social", icon: AtSign, tourId: "social" },
      { title: "Influencers", url: "/influencers", icon: UserCircle, tourId: "influencers" },
    ],
  };

  const clientManageGroup = {
    label: "Manage",
    icon: Settings,
    items: [
      { title: "Research Projects", url: "/matters", icon: FolderOpen, tourId: "matters" },
      { title: "Sources", url: "/sources", icon: Database, tourId: "sources" },
      { title: "Security", url: "/security", icon: Lock, tourId: "security" },
      { title: "Settings", url: "/settings", icon: Settings, tourId: "settings" },
    ],
  };

  const clientSportsGroup = {
    label: "Sports",
    icon: Trophy,
    items: [
      { title: "Sports Dashboard", url: "/sports", icon: Trophy, tourId: "sports" },
    ],
  };

  const clientMarketingGroup = {
    label: "Marketing Intel",
    icon: TrendingUp,
    items: [
      { title: "Marketing Dashboard", url: "/marketing", icon: BarChart3, tourId: "marketing" },
    ],
  };

  const clientGroups = [
    clientDirectoryGroup,
    clientLegislativeGroup,
    clientNewsGroup,
    clientStrategyGroup,
    clientSocialGroup,
    ...(hasSportsModule ? [clientSportsGroup] : []),
    ...(hasMarketingModule ? [clientMarketingGroup] : []),
    clientManageGroup,
  ];

  const isClientView = !isSuperAdmin || isImpersonating;
  const groupLabel = (isSuperAdmin && !isImpersonating) 
    ? "Platform Admin" 
    : (isImpersonating ? userRole?.impersonatingClientName : userRole?.clientName) || "Dashboard";

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
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            {(isSuperAdmin && !isImpersonating) ? (
              <Shield className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Building2 className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          <div>
            <span className="font-semibold text-sm">Political Intel</span>
            {(isSuperAdmin && !isImpersonating) && (
              <p className="text-xs text-muted-foreground">Super Admin</p>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            {isClientView ? (
              <SidebarMenu>
                {clientTopItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url || location.startsWith(item.url + "/")}
                    >
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
                
                {clientGroups.map((group) => {
                  const isGroupActive = group.items.some(
                    (item) => location === item.url || location.startsWith(item.url + "/")
                  );
                  return (
                    <Collapsible 
                      key={group.label} 
                      defaultOpen={isGroupActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            data-testid={`nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <group.icon className="w-4 h-4" />
                            <span>{group.label}</span>
                            <ChevronRight className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {group.items.map((item) => (
                              <SidebarMenuSubItem key={item.title}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={location === item.url || location.startsWith(item.url + "/")}
                                >
                                  <Link 
                                    href={item.url}
                                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                                    data-tour={item.tourId}
                                  >
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}

                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/modules" || location.startsWith("/modules/")}
                  >
                    <Link
                      href="/modules"
                      data-testid="nav-modules"
                      data-tour="modules"
                    >
                      <Puzzle className="w-4 h-4" />
                      <span>Modules</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            ) : (
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url || location.startsWith(item.url + "/")}
                    >
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
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-full flex items-center gap-3 p-2 rounded-md hover-elevate"
              data-testid="button-user-menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium truncate">{getDisplayName()}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {isSuperAdmin ? "Super Admin" : userRole?.role || "Member"}
                </p>
              </div>
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
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
