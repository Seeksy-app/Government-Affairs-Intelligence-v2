import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Newspaper, Network, Shield, TrendingUp } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Newco</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Features</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors text-sm">About</a>
          </div>
          <Button asChild data-testid="button-login-nav">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
                  Political Intelligence
                  <span className="text-primary"> Platform</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Track staffers, monitor legislation, and map relationships across the political landscape. 
                  The intelligence platform trusted by leading government affairs firms.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login">Get Started</a>
                </Button>
                <Button size="lg" variant="outline" data-testid="button-learn-more">
                  Learn More
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Enterprise-grade security</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Real-time updates</span>
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-2xl" />
              <div className="bg-card border rounded-2xl p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Contact Network</p>
                    <p className="text-sm text-muted-foreground">Track 50,000+ political contacts</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Network className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Career Mapping</p>
                    <p className="text-sm text-muted-foreground">Trace career paths and connections</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Newspaper className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">News Intelligence</p>
                    <p className="text-sm text-muted-foreground">AI-powered news aggregation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Powerful Tools for Government Affairs
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to stay ahead in the political landscape, all in one platform.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Contact Management</h3>
                <p className="text-muted-foreground text-sm">
                  Comprehensive database of staffers, officials, and political operatives with detailed profiles and contact information.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Network className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Career Pattern Analysis</h3>
                <p className="text-muted-foreground text-sm">
                  Track career trajectories from internships to senior positions. Understand who mentored whom and trace influence networks.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Newspaper className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">News Aggregation</h3>
                <p className="text-muted-foreground text-sm">
                  AI-powered news monitoring tailored to your interests. Stay informed on legislation, policy changes, and political developments.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Multi-Tenant Platform</h3>
                <p className="text-muted-foreground text-sm">
                  Secure, isolated workspaces for each client firm with granular access controls and team collaboration features.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Enterprise Security</h3>
                <p className="text-muted-foreground text-sm">
                  Bank-level encryption, audit logs, and compliance features to protect sensitive political intelligence.
                </p>
              </CardContent>
            </Card>
            <Card className="hover-elevate">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Analytics Dashboard</h3>
                <p className="text-muted-foreground text-sm">
                  Visual insights into your network, engagement metrics, and trend analysis for strategic decision-making.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">
            Built for Government Affairs Professionals
          </h2>
          <p className="text-muted-foreground text-lg">
            Newco was built by lobbyists, for lobbyists. We understand the unique challenges of 
            navigating the political landscape and have created tools that streamline your workflow, 
            enhance your intelligence gathering, and give you the competitive edge you need.
          </p>
          <Button size="lg" asChild data-testid="button-cta-bottom">
            <a href="/api/login">Start Your Free Trial</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Newco Platform</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Newco. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
