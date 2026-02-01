import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Users, Newspaper, Network, Shield, TrendingUp, Bot, FileText, Target, Briefcase, Check } from "lucide-react";
import heroCapitolImage from "@/assets/images/hero-capitol.jpg";
import meetingImage from "@/assets/images/meeting.jpg";
import dcMonumentsImage from "@/assets/images/dc-monuments.jpg";

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
            <span className="font-semibold text-lg">Political Intel</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Pricing</a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors text-sm">About</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" asChild data-testid="button-signup-nav">
              <a href="/signup">Sign Up</a>
            </Button>
            <Button asChild data-testid="button-login-nav">
              <a href="/login">Sign In</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden mb-12">
            <img 
              src={heroCapitolImage} 
              alt="US Capitol Building" 
              className="w-full h-64 md:h-80 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="px-8 md:px-12 max-w-2xl space-y-4">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold tracking-tight leading-tight text-foreground">
                  Delivering Results
                  <span className="text-primary"> That Matter</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground">
                  Navigate the complexities of government with confidence. Strategic guidance, 
                  comprehensive research, and tailored solutions for federal advocacy.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button size="lg" asChild data-testid="button-get-started">
                    <a href="/signup">Get Started</a>
                  </Button>
                  <Button size="lg" variant="outline" className="bg-background/50 backdrop-blur-sm" asChild data-testid="button-learn-more">
                    <a href="#features">Learn More</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Value Props */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Strategic Advocacy</h3>
                <p className="text-sm text-muted-foreground">
                  Beyond simple reporting and political intelligence to immediate strategy plans for success.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Professional Services</h3>
                <p className="text-sm text-muted-foreground">
                  Expert team dedicated to exceptional results with insights and innovative solutions.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Policy Expertise</h3>
                <p className="text-sm text-muted-foreground">
                  Deep understanding of transportation, infrastructure, public safety, and regulatory landscapes.
                </p>
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
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">AI Research Agent</h3>
                <p className="text-muted-foreground text-sm">
                  Ask questions about your research documents, extract insights from web content and YouTube videos, and get AI-powered analysis.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Image Banner Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative rounded-xl overflow-hidden group">
              <img 
                src={meetingImage} 
                alt="Government affairs meeting" 
                className="w-full h-64 object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-lg font-semibold text-white">Strategic Consulting</h3>
                <p className="text-sm text-white/80">Empower your team with real-time political intelligence</p>
              </div>
            </div>
            <div className="relative rounded-xl overflow-hidden group">
              <img 
                src={dcMonumentsImage} 
                alt="Washington DC monuments" 
                className="w-full h-64 object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h3 className="text-lg font-semibold text-white">Capitol Hill Expertise</h3>
                <p className="text-sm text-white/80">Deep insights into the corridors of power</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your firm's needs. All plans include a 14-day free trial.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <Card className="relative">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Starter</CardTitle>
                <CardDescription>For small firms getting started</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">$299</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Up to 3 team members</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>500 contact records</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>5 active matters</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Basic news monitoring</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Email support</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline" asChild>
                  <a href="/signup">Start Free Trial</a>
                </Button>
              </CardContent>
            </Card>

            {/* Professional Plan */}
            <Card className="relative border-primary">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Professional</CardTitle>
                <CardDescription>For growing advocacy practices</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">$799</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Up to 10 team members</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Unlimited contacts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>25 active matters</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>AI research agent</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Bill tracking with alerts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" asChild>
                  <a href="/signup">Start Free Trial</a>
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <CardDescription>For large firms and organizations</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">$1,999</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Unlimited team members</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Unlimited contacts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Unlimited matters</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Advanced AI research</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Client portals</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Dedicated account manager</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0" />
                    <span>Custom integrations</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline" asChild>
                  <a href="/signup">Contact Sales</a>
                </Button>
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
            This platform was built by lobbyists, for lobbyists. We understand the unique challenges of 
            navigating the political landscape and have created tools that streamline your workflow, 
            enhance your intelligence gathering, and give you the competitive edge you need.
          </p>
          <Button size="lg" asChild data-testid="button-cta-bottom">
            <a href="/signup">Start Your Free Trial</a>
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
            <span className="text-sm text-muted-foreground">Political Intel Platform</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Political Intelligence Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
