import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  TrendingUp, 
  Rocket, 
  Target, 
  DollarSign, 
  Award,
  CheckCircle2,
  Users,
  Building2,
  Landmark,
  Globe,
  Zap,
  Shield,
  Brain,
  Handshake,
  Calendar
} from "lucide-react";

export default function AdminBusinessDev() {
  const [activeTab, setActiveTab] = useState("business-plan");

  return (
    <div className="p-6 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold font-serif" data-testid="text-busdev-title">
          Business Development
        </h1>
        <p className="text-muted-foreground mt-1">
          Strategic planning and growth roadmap for Government Affairs Platform
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 bg-muted/50">
          <TabsTrigger value="business-plan" className="flex items-center gap-2" data-testid="tab-business-plan">
            <FileText className="h-4 w-4" />
            Business Plan
          </TabsTrigger>
          <TabsTrigger value="projections" className="flex items-center gap-2" data-testid="tab-projections">
            <TrendingUp className="h-4 w-4" />
            3-Year Projections
          </TabsTrigger>
          <TabsTrigger value="go-to-market" className="flex items-center gap-2" data-testid="tab-go-to-market">
            <Rocket className="h-4 w-4" />
            Go-to-Market
          </TabsTrigger>
        </TabsList>

        {/* Business Plan Tab */}
        <TabsContent value="business-plan" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Executive Summary */}
            <Card data-testid="card-executive-summary" className="border-l-4 border-l-primary overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Government Affairs Platform is an AI-powered political intelligence platform that 
                  revolutionizes how lobbying firms and municipalities track legislation, manage 
                  congressional relationships, and secure federal funding. Our platform provides 
                  real-time insights, automated news intelligence, and AI research agents.
                </p>
                <div className="space-y-3 pt-2">
                  <p className="font-semibold">Key Value Propositions:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">AI-powered research agents with Perplexity integration</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Real-time congressional schedule & committee tracking</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Automated news intelligence with relevance scoring</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Client portal system for transparent stakeholder reporting</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Market */}
            <Card data-testid="card-target-market" className="border-l-4 border-l-blue-500 overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Target Market
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Primary: Lobbying & Government Affairs Firms</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    12,000+ registered federal lobbyists and 2,500+ lobbying firms seeking 
                    competitive intelligence and relationship management tools.
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Secondary: US Cities & Municipalities</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    19,000+ cities and 3,000+ counties seeking federal grant funding and 
                    needing legislative tracking capabilities.
                  </p>
                </div>
                <div className="pt-2 space-y-1 text-sm">
                  <p><span className="font-semibold">TAM:</span> $8.5B government affairs software market</p>
                  <p><span className="font-semibold">SAM:</span> $1.2B political intelligence segment</p>
                  <p><span className="font-semibold">SOM:</span> $85M initial addressable market</p>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Model */}
            <Card data-testid="card-revenue-model" className="border-l-4 border-l-emerald-500 overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Revenue Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold">Federal Research</p>
                    <p className="text-sm text-muted-foreground">Federal-level only, min 2 users</p>
                  </div>
                  <span className="font-bold text-lg">$2,500/mo</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-semibold">Full Platform License</p>
                    <p className="text-sm text-muted-foreground">Per user/year, min 2 users</p>
                  </div>
                  <span className="font-bold text-lg">$25,000/yr</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold">Enterprise</p>
                    <p className="text-sm text-muted-foreground">Unlimited users + API + custom</p>
                  </div>
                  <Badge variant="secondary">Custom</Badge>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Minimum Contract</p>
                  <p>2 users x $25,000/yr = $50,000/yr per firm</p>
                </div>
              </CardContent>
            </Card>

            {/* Competitive Advantage */}
            <Card data-testid="card-competitive-advantage" className="border-l-4 border-l-purple-500 overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Competitive Advantage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">AI-First Architecture</p>
                    <p className="text-sm text-muted-foreground">
                      Perplexity-powered research agents with real-time web access and source citations
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Congress.gov API Integration</p>
                    <p className="text-sm text-muted-foreground">
                      Official data source for members, bills, and committee schedules
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">High-Intent Keyword Detection</p>
                    <p className="text-sm text-muted-foreground">
                      Proprietary relevance scoring for news prioritization
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Multi-Tenant Security</p>
                    <p className="text-sm text-muted-foreground">
                      Complete data isolation with client-specific portals
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 3-Year Projections Tab */}
        <TabsContent value="projections" className="space-y-6 mt-6">
          <Card data-testid="card-projections" className="border-t-4 border-t-primary overflow-visible">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                Three-Year Financial Projections
              </CardTitle>
              <p className="text-sm text-muted-foreground ml-11">
                Based on government affairs industry growth rates and SaaS benchmarks
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 font-medium">Metric</th>
                      <th className="text-right py-3 px-4 font-medium">Year 1</th>
                      <th className="text-right py-3 px-4 font-medium">Year 2</th>
                      <th className="text-right py-3 px-4 font-medium">Year 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-3 px-4">Full Platform Firms ($25K/yr/user)</td>
                      <td className="text-right py-3 px-4">8</td>
                      <td className="text-right py-3 px-4">25</td>
                      <td className="text-right py-3 px-4">60</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Federal Research Firms ($2.5K/mo/user)</td>
                      <td className="text-right py-3 px-4">5</td>
                      <td className="text-right py-3 px-4">20</td>
                      <td className="text-right py-3 px-4">50</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Avg. Users per Firm</td>
                      <td className="text-right py-3 px-4">3</td>
                      <td className="text-right py-3 px-4">4</td>
                      <td className="text-right py-3 px-4">5</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Min Contract (2 users x $25K)</td>
                      <td className="text-right py-3 px-4" colSpan={3}>$50,000/yr per firm</td>
                    </tr>
                    <tr className="bg-muted/50">
                      <td className="py-3 px-4 font-semibold">Full Platform ARR</td>
                      <td className="text-right py-3 px-4 font-semibold">$600K</td>
                      <td className="text-right py-3 px-4 font-semibold">$2.5M</td>
                      <td className="text-right py-3 px-4 font-semibold">$7.5M</td>
                    </tr>
                    <tr className="bg-muted/50">
                      <td className="py-3 px-4 font-semibold">Federal Research ARR</td>
                      <td className="text-right py-3 px-4 font-semibold">$450K</td>
                      <td className="text-right py-3 px-4 font-semibold">$2.4M</td>
                      <td className="text-right py-3 px-4 font-semibold">$7.5M</td>
                    </tr>
                    <tr className="bg-primary/5">
                      <td className="py-3 px-4 font-bold">Total ARR</td>
                      <td className="text-right py-3 px-4 font-bold">$1.05M</td>
                      <td className="text-right py-3 px-4 font-bold">$4.9M</td>
                      <td className="text-right py-3 px-4 font-bold">$15M</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Gross Margin</td>
                      <td className="text-right py-3 px-4">68%</td>
                      <td className="text-right py-3 px-4">75%</td>
                      <td className="text-right py-3 px-4">82%</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Customer Churn Rate</td>
                      <td className="text-right py-3 px-4">8%</td>
                      <td className="text-right py-3 px-4">5%</td>
                      <td className="text-right py-3 px-4">3%</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">Net Revenue Retention</td>
                      <td className="text-right py-3 px-4">115%</td>
                      <td className="text-right py-3 px-4">125%</td>
                      <td className="text-right py-3 px-4">135%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Industry Tailwinds */}
            <Card data-testid="card-tailwinds" className="border-l-4 border-l-emerald-500 overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Industry Tailwinds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Lobbying industry growing 6.2% CAGR</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Federal grant programs expanding post-IRA/CHIPS</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>AI adoption accelerating (42% YoY) in professional services</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Digital transformation mandate in government relations</span>
                </div>
              </CardContent>
            </Card>

            {/* Key Assumptions */}
            <Card data-testid="card-assumptions" className="border-l-4 border-l-blue-500 overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Key Assumptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Min 2 users per firm ($50K+ floor)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>3.5x firm growth Y1→Y2</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Avg users per firm grows 3→4→5</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>AI costs declining 25% annually</span>
                </div>
              </CardContent>
            </Card>

            {/* Investment Needs */}
            <Card data-testid="card-investment" className="border-l-4 border-l-orange-500 overflow-visible">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg">Investment Needs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Year 1: $400K (product + initial sales)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Year 2: $900K (scale sales team)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Year 3: $1.5M (market expansion)</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <span>Break-even: Month 22</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Go-to-Market Tab */}
        <TabsContent value="go-to-market" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Phase 1 */}
            <Card data-testid="card-phase1" className="border-t-4 border-t-blue-500 overflow-visible">
              <CardHeader className="bg-blue-500/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Phase 1: Foundation (Months 1-6)
                </CardTitle>
                <p className="text-sm text-muted-foreground ml-11">Build credibility and early adopters</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">Target: 5-8 founding firms ($50K+ contracts)</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Direct outreach to DC lobbying networks</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">American League of Lobbyists conference presence</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Free 30-day trial with white-glove onboarding</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Case study development with founding customers</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Budget: $80K | CAC Target: $8,000
                </p>
              </CardContent>
            </Card>

            {/* Phase 2 */}
            <Card data-testid="card-phase2" className="border-t-4 border-t-emerald-500 overflow-visible">
              <CardHeader className="bg-emerald-500/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Phase 2: Scale (Months 7-12)
                </CardTitle>
                <p className="text-sm text-muted-foreground ml-11">Accelerate with proven playbook</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">Target: 15-25 licensed firms</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">LinkedIn/Google Ads campaigns</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Content marketing (blog, policy webinars)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Municipal government outreach program</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Referral incentive program</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Budget: $120K | CAC Target: $4,000
                </p>
              </CardContent>
            </Card>

            {/* Phase 3 */}
            <Card data-testid="card-phase3" className="border-t-4 border-t-purple-500 overflow-visible">
              <CardHeader className="bg-purple-500/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  Phase 3: Expand (Year 2)
                </CardTitle>
                <p className="text-sm text-muted-foreground ml-11">Multi-channel growth engine</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">Target: 45+ firms, $5M ARR</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Dedicated sales team (2-3 reps)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">State capitol expansion (top 15 states)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Integration partnerships (CRM, legal tech)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">NLC & USCM conference presence</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Budget: $350K | CAC Target: $3,500
                </p>
              </CardContent>
            </Card>

            {/* Phase 4 */}
            <Card data-testid="card-phase4" className="border-t-4 border-t-orange-500 overflow-visible">
              <CardHeader className="bg-orange-500/5 border-b">
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <Handshake className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  Phase 4: Dominate (Year 3)
                </CardTitle>
                <p className="text-sm text-muted-foreground ml-11">Category leadership</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-semibold">Target: 110+ firms, $15M ARR</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Channel partner program</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Strategic acquisitions (data providers)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">All 50 states coverage</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Enterprise API & white-label options</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pt-2">
                  Budget: $500K | CAC Target: $3,000
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Channel Mix Strategy */}
          <Card data-testid="card-channel-mix" className="border-t-4 border-t-primary overflow-visible">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
                Channel Mix Strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">45%</p>
                  <p className="font-semibold mt-1">Direct Sales</p>
                  <p className="text-xs text-muted-foreground">Outbound + conferences</p>
                </div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">25%</p>
                  <p className="font-semibold mt-1">Inbound Marketing</p>
                  <p className="text-xs text-muted-foreground">SEO, content, ads</p>
                </div>
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">15%</p>
                  <p className="font-semibold mt-1">Partners</p>
                  <p className="text-xs text-muted-foreground">Law firms, consultants</p>
                </div>
                <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">15%</p>
                  <p className="font-semibold mt-1">Referrals</p>
                  <p className="text-xs text-muted-foreground">Customer advocacy</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
