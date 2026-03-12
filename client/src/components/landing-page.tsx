import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, Newspaper, Network, Shield, Bot, FileText,
  Target, Briefcase, BarChart3, MapPin, Brain, Zap, Globe,
  ChevronRight, ArrowRight, CheckCircle2, Star, Lock, TrendingUp,
  Search, Layers, BookOpen, Radio, Map
} from "lucide-react";
import { Link } from "wouter";
import heroCapitolImage from "@/assets/images/hero-capitol.jpg";
import meetingImage from "@/assets/images/meeting.jpg";
import dcMonumentsImage from "@/assets/images/dc-monuments.jpg";

const STATS = [
  { value: "12,000+", label: "Congressional Staffers" },
  { value: "9,400+", label: "House Directory Entries" },
  { value: "535", label: "Members Tracked" },
  { value: "AI-First", label: "Research Engine" },
];

const CORE_FEATURES = [
  {
    icon: Map,
    title: "Strategy Board",
    desc: "Five-layer intelligence system: Access Map, Pipeline, Bill Influence, Path Finder, and Power Grid. Visualize your path to any member of Congress.",
    color: "from-blue-500/20 to-blue-600/5",
    accent: "text-blue-500",
  },
  {
    icon: Users,
    title: "Congressional Staff Directory",
    desc: "12,000+ staffers from LegiStorm with titles, contact info, position histories, and AI career research — all searchable in real-time.",
    color: "from-purple-500/20 to-purple-600/5",
    accent: "text-purple-500",
  },
  {
    icon: Brain,
    title: "AI Research Agent",
    desc: "Powered by Perplexity and OpenAI. Research any staffer, member, or issue. Scrape web content, extract YouTube transcripts, and synthesize intelligence.",
    color: "from-emerald-500/20 to-emerald-600/5",
    accent: "text-emerald-500",
  },
  {
    icon: Newspaper,
    title: "News Intelligence",
    desc: "Aggregated news from Politico, The Hill, Roll Call, Defense News, and 10+ more feeds with AI keyword matching and daily brief delivery.",
    color: "from-orange-500/20 to-orange-600/5",
    accent: "text-orange-500",
  },
  {
    icon: TrendingUp,
    title: "Bill & Staffer Mapping",
    desc: "Map any congressional staffer to the bills they shaped — drafting, negotiating, floor managing. Powered by Congress.gov + AI enrichment.",
    color: "from-rose-500/20 to-rose-600/5",
    accent: "text-rose-500",
  },
  {
    icon: Globe,
    title: "Organization Intelligence",
    desc: "Search and enrich lobbying firms, PACs, think tanks, and government agencies via People Data Labs. Instant org charts and key people discovery.",
    color: "from-sky-500/20 to-sky-600/5",
    accent: "text-sky-500",
  },
];

const MODULES = [
  {
    icon: BarChart3,
    label: "Sports Intelligence",
    desc: "Track sports organizations, find key contacts, manage partnership outreach pipelines."
  },
  {
    icon: Target,
    label: "Marketing Intelligence",
    desc: "OOH ROI analysis, channel performance, conversion funnels, and AI marketing strategy."
  },
  {
    icon: Shield,
    label: "Veterans Search",
    desc: "Identify veteran Congress members and military liaison staffers. Service branch, rank, and years tracked."
  },
  {
    icon: Radio,
    label: "Social Media Tracking",
    desc: "Monitor X/Twitter accounts, track engagement, set keyword alerts, and auto-sync posts."
  },
  {
    icon: Search,
    label: "Google Rank Tracking",
    desc: "Monitor search rankings across desktop, mobile, and tablet with historical trend analysis."
  },
  {
    icon: BookOpen,
    label: "Client Portals",
    desc: "Deliver curated intelligence to clients in isolated, branded research workspaces."
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Select Your Target",
    desc: "Search any Member of Congress, committee, or issue area. Access Map instantly surfaces all staffers with influence scores.",
  },
  {
    step: "02",
    title: "Map the Path",
    desc: "Path Finder identifies direct connections through your contact network and committee relationships. AI recommends your best entry point.",
  },
  {
    step: "03",
    title: "Research Deep",
    desc: "Pull full career histories, bill associations, and AI-synthesized intelligence on every contact. Know who they are before the call.",
  },
  {
    step: "04",
    title: "Execute & Track",
    desc: "Move contacts through your Pipeline kanban. Track every touchpoint, assign matters, and deliver client reports — all in one place.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/85 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Building2 className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">governmentaffairs<span className="text-primary">.co</span></span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            <a href="#platform" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">Platform</a>
            <a href="#modules" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">Modules</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">How It Works</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <a href="/login">Sign In</a>
            </Button>
            <Button size="sm" asChild data-testid="button-request-access-nav">
              <a href="/signup">Request Access <ChevronRight className="w-3.5 h-3.5 ml-1" /></a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroCapitolImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px"
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-3xl space-y-7">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-medium tracking-wide uppercase">
              <Zap className="w-3 h-3" /> Early Access — Invite Only
            </Badge>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tight leading-[1.05]">
              The Intelligence
              <br />
              <span className="text-primary">Engine for</span>
              <br />
              Government Affairs
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              A complete political intelligence platform purpose-built for lobbying firms. 
              Map access, research staffers, track legislation, and execute strategy — all in one place.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button size="lg" className="text-base px-8 h-12 shadow-lg" asChild data-testid="button-hero-request">
                <a href="/signup">Request Access <ArrowRight className="w-4 h-4 ml-2" /></a>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 bg-background/60 backdrop-blur-sm" asChild data-testid="button-hero-demo">
                <a href="/demo">Watch Demo</a>
              </Button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-border/40">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Marquee trust bar */}
      <div className="bg-card/80 border-y border-border/50 py-4 overflow-hidden">
        <div className="flex items-center gap-12 px-6 flex-wrap justify-center text-xs text-muted-foreground font-medium uppercase tracking-widest">
          <span className="flex items-center gap-2"><Lock className="w-3 h-3" /> Enterprise Security</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Congress.gov API</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> LegiStorm Data</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> People Data Labs</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Perplexity AI</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> Firecrawl Intelligence</span>
          <span className="flex items-center gap-2"><Shield className="w-3 h-3" /> Multi-Tenant Isolation</span>
        </div>
      </div>

      {/* Core Platform Features */}
      <section id="platform" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="text-xs font-medium uppercase tracking-wide">Platform</Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold">
              Built for how lobbyists<br />actually work
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every feature was designed around real government affairs workflows — not generic CRM tools bolted onto political data.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CORE_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`relative rounded-2xl border border-border/50 bg-gradient-to-br ${f.color} p-6 space-y-4 group hover:border-border transition-colors duration-300`}
                >
                  <div className={`w-11 h-11 rounded-xl bg-background/80 flex items-center justify-center shadow-sm`}>
                    <Icon className={`w-5 h-5 ${f.accent}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Strategy Board Spotlight */}
      <section className="py-24 px-6 bg-card/40 border-y border-border/40">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-7">
              <Badge variant="outline" className="text-xs font-medium uppercase tracking-wide">Strategy Board</Badge>
              <h2 className="text-4xl md:text-5xl font-serif font-bold leading-tight">
                Five tools.<br />One unified<br /><span className="text-primary">intelligence view.</span>
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                The Strategy Board is the operational center of the platform. It gives you five distinct lenses on your political landscape — from raw access mapping to AI-powered path recommendations.
              </p>
              <div className="space-y-4">
                {[
                  { name: "Access Map", detail: "See every staffer for any member, sorted by influence score" },
                  { name: "Pipeline", detail: "Kanban board to track your engagement stage with every contact" },
                  { name: "Bill Influence", detail: "Search legislation and find who championed it" },
                  { name: "Path Finder", detail: "AI-recommended routes through your network to reach any target" },
                  { name: "Power Grid", detail: "Member-by-member staff density and key contact overview" },
                ].map((item) => (
                  <div key={item.name} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-sm">{item.name}</span>
                      <span className="text-muted-foreground text-sm"> — {item.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={dcMonumentsImage}
                alt="Washington DC"
                className="w-full h-80 lg:h-[460px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <div className="grid grid-cols-3 gap-3">
                  {["Access Map", "Path Finder", "Power Grid"].map((tab) => (
                    <div key={tab} className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center border border-border/50">
                      <p className="text-xs font-semibold">{tab}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="text-xs font-medium uppercase tracking-wide">Workflow</Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold">From target to meeting<br />in four steps</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A repeatable intelligence workflow that professional government affairs teams run every day.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WORKFLOW.map((w, i) => (
              <div key={w.step} className="relative">
                {i < WORKFLOW.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-border/60 z-0" style={{ width: "calc(100% - 2rem)", left: "calc(100% - 1rem)" }} />
                )}
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-5xl font-black text-primary/15 leading-none font-mono">{w.step}</span>
                  </div>
                  <h3 className="font-bold text-lg">{w.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Image Split */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <img
              src={meetingImage}
              alt="Government affairs meeting"
              className="w-full h-72 md:h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
            <div className="absolute inset-0 flex items-center">
              <div className="px-10 md:px-16 max-w-xl space-y-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Built by lobbyists, for lobbyists</p>
                <h2 className="text-3xl md:text-4xl font-serif font-bold leading-tight">
                  Your intelligence advantage starts here
                </h2>
                <p className="text-muted-foreground">
                  We've embedded decades of government affairs expertise directly into the platform. Every workflow reflects how top lobbying shops actually operate.
                </p>
                <Button asChild data-testid="button-mid-request">
                  <a href="/signup">Request Access <ArrowRight className="w-4 h-4 ml-1.5" /></a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-24 px-6 bg-card/40 border-t border-border/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <Badge variant="outline" className="text-xs font-medium uppercase tracking-wide">Add-On Modules</Badge>
            <h2 className="text-4xl md:text-5xl font-serif font-bold">Expand your capabilities</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Every client gets the full core platform. Activate specialized modules based on your practice areas.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="flex items-start gap-4 p-5 rounded-xl border border-border/50 bg-background hover:bg-card transition-colors duration-200 group">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{m.label}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Lock,
                title: "Multi-Tenant Isolation",
                desc: "Every firm gets a fully isolated workspace. Your intelligence never touches another client's data."
              },
              {
                icon: Shield,
                title: "Enterprise-Grade Security",
                desc: "Session-based auth, bcrypt password hashing, encrypted data at rest and in transit."
              },
              {
                icon: Layers,
                title: "Module-Level Gating",
                desc: "Super admin controls which features each firm accesses. Granular permission management at every level."
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="p-6 rounded-2xl border border-border/50 bg-card/50 space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 border-t border-border/40">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Star className="w-3.5 h-3.5" /> Invite-Only Early Access
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold leading-tight">
            Ready to outmaneuver<br />the competition?
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Join the government affairs firms using AI-powered intelligence to win more for their clients. Apply for early access today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button size="lg" className="text-base px-10 h-13 shadow-lg h-12" asChild data-testid="button-cta-bottom">
              <a href="/signup">Request Early Access <ArrowRight className="w-4 h-4 ml-2" /></a>
            </Button>
            <Button size="lg" variant="outline" className="text-base h-12" asChild data-testid="button-cta-demo">
              <a href="/demo">Watch Demo</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            No commitment required. Our team reviews every application personally.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-6 bg-card/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold tracking-tight">governmentaffairs<span className="text-primary">.co</span></span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">
                Political intelligence platform for government affairs professionals.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/demo">
                <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors" data-testid="link-footer-demo">
                  Watch Demo
                </span>
              </Link>
              <Link href="/security-privacy">
                <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors" data-testid="link-security-privacy">
                  Privacy & Security
                </span>
              </Link>
              <Link href="/terms">
                <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors" data-testid="link-terms">
                  Terms
                </span>
              </Link>
              <Link href="/privacy">
                <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors" data-testid="link-privacy">
                  Privacy Policy
                </span>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} governmentaffairs.co
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
