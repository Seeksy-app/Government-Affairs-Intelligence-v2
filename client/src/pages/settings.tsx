import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Shield, LogOut, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery } from "@tanstack/react-query";

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  role?: string;
}

export default function SettingsPage() {
  const { user, logout, isLoggingOut } = useAuth();

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold font-serif" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg" data-testid="text-user-name">
                {getDisplayName()}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span data-testid="text-user-email">{user?.email || "No email"}</span>
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Role</p>
                <p className="text-sm text-muted-foreground">Your access level</p>
              </div>
              <Badge variant={userRole?.isSuperAdmin ? "default" : "secondary"}>
                {userRole?.isSuperAdmin ? (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Super Admin
                  </span>
                ) : (
                  userRole?.role || "Member"
                )}
              </Badge>
            </div>
            {userRole?.clientName && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Organization</p>
                  <p className="text-sm text-muted-foreground">Your client firm</p>
                </div>
                <span className="text-sm">{userRole.clientName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            Account Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <Button 
              variant="destructive" 
              onClick={() => logout()}
              disabled={isLoggingOut}
              data-testid="button-logout"
            >
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
