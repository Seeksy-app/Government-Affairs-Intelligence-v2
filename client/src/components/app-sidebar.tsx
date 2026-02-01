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
import { Building2, Users, Network, Newspaper, LayoutDashboard, Settings, ChevronUp, LogOut, Shield, FolderOpen, Book, Lock, Share2, Bot } from "lucide-react";

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
    { title: "Clients", url: "/admin/clients", icon: Building2, tourId: "admin-clients" },
    { title: "Users", url: "/admin/users", icon: Users, tourId: "admin-users" },
    { title: "Knowledge Base", url: "/admin/kb", icon: Book, tourId: "admin-kb" },
    { title: "Security", url: "/admin/security", icon: Lock, tourId: "admin-security" },
    { title: "Settings", url: "/admin/settings", icon: Settings, tourId: "admin-settings" },
  ];

  const clientItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, tourId: "dashboard" },
    { title: "Contacts", url: "/contacts", icon: Users, tourId: "contacts" },
    { title: "Matters", url: "/matters", icon: FolderOpen, tourId: "matters" },
    { title: "AI Agent", url: "/ai-agent", icon: Bot, tourId: "ai-agent" },
    { title: "Network", url: "/network", icon: Network, tourId: "network" },
    { title: "News", url: "/news", icon: Newspaper, tourId: "news" },
    { title: "Client Portals", url: "/portals", icon: Share2, tourId: "portals" },
    { title: "Knowledge Base", url: "/kb", icon: Book, tourId: "kb" },
    { title: "Security", url: "/security", icon: Lock, tourId: "security" },
    { title: "Settings", url: "/settings", icon: Settings, tourId: "settings" },
  ];

  // When impersonating, show client menu instead of admin menu
  const menuItems = (isSuperAdmin && !isImpersonating) ? superAdminItems : clientItems;
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
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || location.startsWith(item.url + "/")}
                  >
                    <Link 
                      href={item.url} 
                      data-testid={`nav-${item.title.toLowerCase()}`}
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
