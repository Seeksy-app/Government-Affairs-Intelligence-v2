import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Mail, CheckCircle2, ExternalLink, Copy } from "lucide-react";
import { PageHeader, PageShell } from "@/components/page-header";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useFirmSetup } from "@/hooks/use-firm-setup";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  role?: string;
}

interface MiroStatus {
  connected: boolean;
  hasCredentials: boolean;
  needsAuth?: boolean;
  user?: { name?: string; email?: string };
}

export default function SettingsPage() {
  const { user, logout, isLoggingOut } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

  const { data: miroStatus, isLoading: miroLoading } = useQuery<MiroStatus>({
    queryKey: ["/api/miro/status"],
    enabled: !!user,
  });

  const connectMiro = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/miro/auth");
      return res.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate Miro connection",
        variant: "destructive",
      });
    },
  });

  // Check for Miro OAuth result in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const miroResult = params.get("miro");
    if (miroResult === "success") {
      toast({
        title: "Miro connected",
        description: "Your Miro account is now connected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/miro/status"] });
      window.history.replaceState({}, "", "/settings");
    } else if (miroResult === "error") {
      toast({
        title: "Couldn't connect Miro",
        description: params.get("message") || "Failed to connect to Miro",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, [location, toast]);

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
    <PageShell width="narrow" className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={<span data-testid="text-settings-title">Settings</span>}
        description="Manage your profile, connected services and how the app looks."
        className="mb-0"
      />

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold" data-testid="text-user-name">
                {getDisplayName()}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate" data-testid="text-user-email">{user?.email || "No email"}</span>
              </div>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Role</p>
                <p className="text-sm text-muted-foreground">Your access level</p>
              </div>
              <Badge
                variant="secondary"
                className={`shrink-0 capitalize shadow-none ${userRole?.isSuperAdmin ? "bg-primary/10 text-primary" : ""}`}
              >
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Organization</p>
                  <p className="text-sm text-muted-foreground">Your firm</p>
                </div>
                <span className="min-w-0 truncate text-right text-sm">{userRole.clientName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <PracticeCard />

      {/* Integrations Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>Connect external services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                <span className="text-base font-semibold text-foreground">M</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Miro</p>
                <p className="text-sm text-muted-foreground">
                  {miroStatus?.connected 
                    ? `Connected${miroStatus.user?.name ? ` as ${miroStatus.user.name}` : ""}`
                    : "Create visual network maps"
                  }
                </p>
              </div>
            </div>
            {miroStatus?.connected ? (
              <Badge variant="secondary" className="shrink-0 gap-1 bg-primary/10 text-primary shadow-none">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : miroStatus?.hasCredentials ? (
              <Button
                size="sm"
                onClick={() => connectMiro.mutate()}
                disabled={connectMiro.isPending}
                data-testid="button-connect-miro"
              >
                {connectMiro.isPending ? "Connecting…" : "Connect"}
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Badge variant="outline" className="shrink-0 text-muted-foreground shadow-none">
                Not configured
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite & Share Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite &amp; share</CardTitle>
          <CardDescription>Share this link so others can sign up for an account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={`${window.location.origin}/signup`}
              className="text-sm"
              data-testid="input-signup-link"
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              data-testid="button-copy-signup-link"
              onClick={() => {
                const url = `${window.location.origin}/signup`;
                navigator.clipboard.writeText(url).then(() => {
                  toast({ title: "Link copied", description: "Signup link copied to clipboard" });
                }).catch(() => {
                  toast({ title: "Copy failed", description: "Please select and copy the link manually", variant: "destructive" });
                });
              }}
            >
              <Copy className="h-4 w-4 mr-1.5" />
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can apply to join the platform. Applications will appear in your admin panel for approval.
          </p>
        </CardContent>
      </Card>

      {/* Appearance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => logout()}
              disabled={isLoggingOut}
              data-testid="button-logout"
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}

// The onboarding answers, editable any time.
function PracticeCard() {
  const { data: setup, isError } = useFirmSetup();
  if (isError || !setup) return null;
  const n = setup.clients.length;
  return (
    <Card data-testid="card-practice">
      <CardHeader>
        <CardTitle className="text-base">Your practice and clients</CardTitle>
        <CardDescription>
          {setup.onboarded
            ? `The answers your Today page is built from · ${n} client${n === 1 ? "" : "s"}`
            : "Not set up yet. About ten minutes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/onboarding">{setup.onboarded ? "Edit your answers" : "Start setup"}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/onboarding?step=clients">Manage clients</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
