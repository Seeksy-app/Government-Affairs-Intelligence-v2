import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { Users, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { GlobalAIChat } from "@/components/global-ai-chat";

import NotFound from "@/pages/not-found";
import { LandingPage } from "@/components/landing-page";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminClients from "@/pages/admin-clients";
import AdminKnowledgeBase from "@/pages/admin-knowledge-base";
import AdminSecurity from "@/pages/admin-security";
import ClientDashboard from "@/pages/client-dashboard";
import Contacts from "@/pages/contacts";
import News from "@/pages/news";
import NetworkPage from "@/pages/network";
import SettingsPage from "@/pages/settings";
import MattersPage from "@/pages/matters";
import MatterDetailPage from "@/pages/matter-detail";
import KnowledgeBase from "@/pages/knowledge-base";
import Security from "@/pages/security";
import ClientPortals from "@/pages/client-portals";
import ClientResources from "@/pages/client-resources";
import PublicPortal from "@/pages/public-portal";
import AIAgentPage from "@/pages/ai-agent";
import SourcesPage from "@/pages/sources";
import ClientSignupPage from "@/pages/client-signup";
import VerifyEmailPage from "@/pages/verify-email";
import SetPasswordPage from "@/pages/set-password";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AdminApplications from "@/pages/admin-applications";
import BillTrackingPage from "@/pages/bill-tracking";
import PredictionsPage from "@/pages/predictions";
import SocialTrackingPage from "@/pages/social-tracking";
import InfluencerTrackingPage from "@/pages/influencer-tracking";
import StaffersPage from "@/pages/staffers";
import StafferDetailPage from "@/pages/staffer-detail";

function AuthenticatedRouter() {
  return (
    <Switch>
      {/* Admin routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/clients" component={AdminClients} />
      <Route path="/admin/applications" component={AdminApplications} />
      <Route path="/admin/users" component={AdminDashboard} />
      <Route path="/admin/kb" component={AdminKnowledgeBase} />
      <Route path="/admin/security" component={AdminSecurity} />
      <Route path="/admin/settings" component={SettingsPage} />
      
      {/* Client routes */}
      <Route path="/dashboard" component={ClientDashboard} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/news" component={News} />
      <Route path="/network" component={NetworkPage} />
      <Route path="/matters" component={MattersPage} />
      <Route path="/matters/:id" component={MatterDetailPage} />
      <Route path="/bills" component={BillTrackingPage} />
      <Route path="/predictions" component={PredictionsPage} />
      <Route path="/social" component={SocialTrackingPage} />
      <Route path="/influencers" component={InfluencerTrackingPage} />
      <Route path="/staffers" component={StaffersPage} />
      <Route path="/staffers/:id" component={StafferDetailPage} />
      <Route path="/ai-agent" component={AIAgentPage} />
      <Route path="/sources" component={SourcesPage} />
      <Route path="/portals" component={ClientPortals} />
      <Route path="/resources" component={ClientResources} />
      <Route path="/kb" component={KnowledgeBase} />
      <Route path="/security" component={Security} />
      <Route path="/settings" component={SettingsPage} />
      
      {/* Default redirect based on role */}
      <Route path="/" component={HomeRedirect} />
      
      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function HomeRedirect() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const { data: userRole, isLoading: roleLoading } = useQuery<{
    isSuperAdmin: boolean;
    clientId?: string;
    needsAssignment?: boolean;
  }>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });
  
  useEffect(() => {
    if (!isLoading && !roleLoading && userRole) {
      if (userRole.isSuperAdmin) {
        setLocation("/admin");
      } else if (userRole.clientId) {
        setLocation("/dashboard");
      }
      // If needsAssignment, stay on page showing message
    }
  }, [userRole, isLoading, roleLoading, setLocation]);

  if (isLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (userRole?.needsAssignment) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Awaiting Assignment</h2>
          <p className="text-muted-foreground">
            Your account has been created, but you haven't been assigned to a client organization yet. 
            Please contact your administrator to be added to a client.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-muted-foreground mt-4">Loading...</p>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const { data: userRole } = useQuery<{
    isSuperAdmin: boolean;
    impersonatingClientId?: string;
    impersonatingClientName?: string;
  }>({
    queryKey: ["/api/user/role"],
  });

  const stopImpersonateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/stop-impersonate");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/role"] });
      toast({ title: "Returned to admin view" });
      navigate("/admin");
    },
    onError: (error: Error) => {
      toast({ title: "Error exiting impersonation", description: error.message, variant: "destructive" });
    },
  });

  const isImpersonating = userRole?.isSuperAdmin && userRole?.impersonatingClientId;

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          {isImpersonating && (
            <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-2" data-testid="banner-impersonation">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Viewing as: {userRole?.impersonatingClientName}
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => stopImpersonateMutation.mutate()}
                disabled={stopImpersonateMutation.isPending}
                data-testid="button-stop-impersonation"
              >
                <X className="h-4 w-4 mr-1" />
                Exit
              </Button>
            </div>
          )}
          <header className="flex items-center justify-between p-3 border-b gap-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <GlobalAIChat />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <AuthenticatedRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Public portal route - accessible without authentication
  if (location.startsWith("/portal/")) {
    return (
      <Switch>
        <Route path="/portal/:clientSlug/:portalSlug" component={PublicPortal} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/signup" component={ClientSignupPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/set-password" component={SetPasswordPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/portal/:clientSlug/:portalSlug" component={PublicPortal} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
