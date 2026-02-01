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
import { Building2, Users, Network, Newspaper, LayoutDashboard, Settings, ChevronUp, LogOut, Shield, FolderOpen } from "lucide-react";

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  role?: string;
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

  const isSuperAdmin = userRole?.isSuperAdmin;

  const superAdminItems = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Clients", url: "/admin/clients", icon: Building2 },
    { title: "Users", url: "/admin/users", icon: Users },
    { title: "Settings", url: "/admin/settings", icon: Settings },
  ];

  const clientItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Contacts", url: "/contacts", icon: Users },
    { title: "Matters", url: "/matters", icon: FolderOpen },
    { title: "Network", url: "/network", icon: Network },
    { title: "News", url: "/news", icon: Newspaper },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  const menuItems = isSuperAdmin ? superAdminItems : clientItems;
  const groupLabel = isSuperAdmin ? "Platform Admin" : userRole?.clientName || "Dashboard";

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
            {isSuperAdmin ? (
              <Shield className="w-5 h-5 text-primary-foreground" />
            ) : (
              <Building2 className="w-5 h-5 text-primary-foreground" />
            )}
          </div>
          <div>
            <span className="font-semibold text-sm">Newco</span>
            {isSuperAdmin && (
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
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
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
