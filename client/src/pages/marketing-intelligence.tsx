import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, TrendingUp, DollarSign, Users, Target, Tv, Megaphone,
  Bot, Loader2, Send, Globe, Trophy, MapPin, Plane, Building2,
  ArrowDownRight, ArrowUpRight, ChevronRight, Star, Zap
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart, Legend
} from "recharts";
import type { MarketingIntelligenceData, MarketingAiRecommendation } from "@shared/schema";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 197 37% 24%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toLocaleString();
}

function formatCurrency(num: number): string {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

export default function MarketingIntelligencePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [aiQuestion, setAiQuestion] = useState("");

  const { data: moduleCheck } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/modules/check/marketing_intelligence"],
    enabled: !!user,
  });

  const { data: marketingData = [], isLoading } = useQuery<MarketingIntelligenceData[]>({
    queryKey: ["/api/marketing/data"],
    enabled: !!user && moduleCheck?.enabled === true,
  });

  const { data: recommendations = [] } = useQuery<MarketingAiRecommendation[]>({
    queryKey: ["/api/marketing/recommendations"],
    enabled: !!user && moduleCheck?.enabled === true,
  });

  const aiAnalyzeMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/marketing/ai-analyze", { question });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/recommendations"] });
      toast({ title: "Analysis complete", description: "AI insights have been generated." });
    },
    onError: (error: any) => {
      toast({ title: "Analysis failed", description: error.message, variant: "destructive" });
    },
  });

  if (moduleCheck?.enabled === false) {
    return (
      <div className="flex items-center justify-center h-full p-8" data-testid="marketing-disabled">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Marketing Intelligence Not Enabled</h2>
            <p className="text-sm text-muted-foreground">Contact your administrator to enable the Marketing Intelligence module.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="marketing-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const getDataByCategory = (category: string) =>
    marketingData.filter(d => d.category === category);

  const execSummary = getDataByCategory("executive_summary");
  const oohData = getDataByCategory("ooh_roi");
  const channelData = getDataByCategory("channel_performance");
  const funnelData = getDataByCategory("conversion_funnel");
  const partnershipData = getDataByCategory("partnerships");
  const earnedMediaData = getDataByCategory("earned_media");

  const summaryCards = execSummary.map(d => {
    const data = d.data as any;
    return {
      label: d.label,
      value: data.unit === "USD" ? formatCurrency(data.value) : formatNumber(data.value),
      subtitle: data.period || "",
      growth: data.growth_pct ? `+${data.growth_pct}%` : data.growth || "",
    };
  });

  const oohChartData = oohData.map(d => {
    const data = d.data as any;
    return {
      name: d.label.replace(" Advertising", "").replace(" Program", "").replace(" Campaigns", "").replace(" Signage", ""),
      value: data.donated_value,
      impressions: data.impressions_monthly,
    };
  });

  const channelChartData = channelData.map(d => {
    const data = d.data as any;
    return {
      name: d.label,
      signups: data.signups_driven,
      share: data.channel_share,
      conversionRate: data.conversion_rate,
      costPerSignup: data.cost_per_signup,
    };
  });

  const funnelChartData = funnelData.map(d => {
    const data = d.data as any;
    return {
      name: d.label,
      value: data.value,
      rate: data.rate_from_prev,
    };
  });

  const summaryIcons = [Trophy, Users, TrendingUp, DollarSign];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full" data-testid="marketing-intelligence-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Marketing Intelligence</h1>
          <p className="text-sm text-muted-foreground">Vet Tix Marketing ROI Analysis & GTM Strategy</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Zap className="w-3 h-3 mr-1" /> Powered by AI
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => {
          const Icon = summaryIcons[i] || BarChart3;
          return (
            <Card key={card.label} data-testid={`card-summary-${i}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  {card.growth && (
                    <span className="flex items-center text-green-600 dark:text-green-400">
                      <ArrowUpRight className="w-3 h-3" /> {card.growth}
                    </span>
                  )}
                  <span>{card.subtitle}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tab-list">
          <TabsTrigger value="overview" data-testid="tab-overview">OOH Analysis</TabsTrigger>
          <TabsTrigger value="channels" data-testid="tab-channels">Channels</TabsTrigger>
          <TabsTrigger value="funnel" data-testid="tab-funnel">Funnel</TabsTrigger>
          <TabsTrigger value="partnerships" data-testid="tab-partnerships">Partnerships</TabsTrigger>
          <TabsTrigger value="media" data-testid="tab-media">Earned Media</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">AI Strategy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">OOH Donated Media Value</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={oohChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="Donated Value" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly Impressions by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={oohChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Bar dataKey="impressions" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} name="Monthly Impressions" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">OOH Placement Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {oohData.map((item, i) => {
                  const data = item.data as any;
                  return (
                    <div key={item.id} className="flex items-start justify-between gap-4 p-3 rounded-md border" data-testid={`ooh-item-${i}`}>
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-md bg-muted">
                          {item.label.includes("Airport") ? <Plane className="w-4 h-4" /> :
                           item.label.includes("Billboard") ? <Building2 className="w-4 h-4" /> :
                           item.label.includes("Bus") ? <Globe className="w-4 h-4" /> :
                           <MapPin className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{data.type} &middot; {data.locations?.length || 0} locations</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {data.locations?.slice(0, 4).map((loc: string) => (
                              <Badge key={loc} variant="secondary" className="text-xs">{loc}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(data.donated_value)}</p>
                        <p className="text-xs text-muted-foreground">{formatNumber(data.impressions_monthly)}/mo</p>
                        <Badge variant="outline" className="mt-1 text-xs">{data.status}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signups by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={channelChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Bar dataKey="signups" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} name="Signups" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Channel Mix</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={channelChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="share"
                      nameKey="name"
                      label={({ name, share }) => `${name}: ${share}%`}
                      labelLine={false}
                    >
                      {channelChartData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "13px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Channel Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {channelData.map((item, i) => {
                  const data = item.data as any;
                  return (
                    <div key={item.id} className="p-4 rounded-md border space-y-2" data-testid={`channel-card-${i}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{item.label}</p>
                        <Badge variant="secondary" className="text-xs">{data.channel_share}%</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Signups</p>
                          <p className="font-semibold">{formatNumber(data.signups_driven)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conv. Rate</p>
                          <p className="font-semibold">{data.conversion_rate}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cost/Signup</p>
                          <p className="font-semibold">{data.cost_per_signup === 0 ? "Free" : `$${data.cost_per_signup.toFixed(2)}`}</p>
                        </div>
                        {data.teams && (
                          <div>
                            <p className="text-muted-foreground">Teams</p>
                            <p className="font-semibold">{data.teams}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversion Funnel (2024)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={funnelChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => formatNumber(value)}
                      contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                    />
                    <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.15} name="Users" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage-by-Stage Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {funnelData.map((item, i) => {
                    const data = item.data as any;
                    const maxVal = (funnelData[0]?.data as any)?.value || 1;
                    const pct = (data.value / maxVal) * 100;
                    return (
                      <div key={item.id} className="space-y-1" data-testid={`funnel-stage-${i}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{item.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{formatNumber(data.value)}</span>
                            {data.rate_from_prev && (
                              <Badge variant="secondary" className="text-xs">{data.rate_from_prev}%</Badge>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Overall Conversion</p>
                    <p className="text-lg font-bold">5.0%</p>
                    <p className="text-xs text-muted-foreground">Visitor to Attendee</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Verification Rate</p>
                    <p className="text-lg font-bold">63.2%</p>
                    <p className="text-xs text-muted-foreground">Registration to Verified</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partnerships" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Partnerships</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {partnershipData.map((item, i) => {
                  const data = item.data as any;
                  return (
                    <div key={item.id} className="p-4 rounded-md border space-y-2" data-testid={`partnership-card-${i}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-muted-foreground" />
                          <p className="font-medium text-sm">{item.label}</p>
                        </div>
                        <Badge variant={data.tier === "flagship" ? "default" : "secondary"} className="text-xs">
                          {data.tier}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">League</p>
                          <p className="font-semibold">{data.type}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tickets</p>
                          <p className="font-semibold">{formatNumber(data.tickets_donated)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Events</p>
                          <p className="font-semibold">{data.activation_events}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Years</p>
                          <p className="font-semibold">{data.years_active}</p>
                        </div>
                      </div>
                      {data.suite_access && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 text-amber-500" /> Suite Access
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tickets Donated by Partner</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={partnershipData.map(d => ({
                  name: (d.label as string).split(" ").pop(),
                  tickets: (d.data as any).tickets_donated,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => formatNumber(value)}
                    contentStyle={{ borderRadius: "8px", fontSize: "13px" }}
                  />
                  <Bar dataKey="tickets" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} name="Tickets Donated" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Earned Media Placements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {earnedMediaData.filter(d => (d.data as any).type !== "pitch_package").map((item, i) => {
                    const data = item.data as any;
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-4 p-3 rounded-md border" data-testid={`media-item-${i}`}>
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-muted">
                            <Tv className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{data.outlet} &middot; {data.type}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{data.date}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{formatNumber(data.estimated_reach)}</p>
                          <p className="text-xs text-muted-foreground">est. reach</p>
                          <Badge variant="outline" className="mt-1 text-xs capitalize">{data.sentiment}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fox News Pitch Packages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {earnedMediaData.filter(d => (d.data as any).type === "pitch_package").map((item, i) => {
                    const data = item.data as any;
                    return (
                      <div key={item.id} className="p-4 rounded-md border space-y-3" data-testid={`pitch-package-${i}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-sm">{item.label}</p>
                          <Badge className="text-xs">{formatCurrency(data.package_value)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Target: {data.target}</p>
                        <div className="flex flex-wrap gap-1">
                          {data.includes?.map((inc: string) => (
                            <Badge key={inc} variant="secondary" className="text-xs">{inc}</Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" /> AI Marketing Analyst
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ask questions about the Vet Tix marketing data to get AI-powered insights and GTM recommendations.
              </p>
              <div className="flex gap-2">
                <Textarea
                  placeholder="e.g., What's the ROI on airport OOH vs billboard campaigns? How can we optimize the conversion funnel?"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="input-ai-question"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "What are the best performing marketing channels and why?",
                  "How can we improve the 14.8% visitor-to-registration rate?",
                  "Recommend a GTM strategy for Q4 2025 NFL season",
                  "Analyze the Fox News pitch packages - which is better value?",
                ].map((q) => (
                  <Button
                    key={q}
                    variant="outline"
                    size="sm"
                    onClick={() => setAiQuestion(q)}
                    data-testid={`button-preset-${q.slice(0, 20).replace(/\s/g, "-")}`}
                  >
                    {q.length > 50 ? q.slice(0, 50) + "..." : q}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => {
                  if (aiQuestion.trim()) aiAnalyzeMutation.mutate(aiQuestion);
                }}
                disabled={!aiQuestion.trim() || aiAnalyzeMutation.isPending}
                data-testid="button-ai-analyze"
              >
                {aiAnalyzeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Analyze</>
                )}
              </Button>

              {aiAnalyzeMutation.data && (
                <div className="mt-4 p-4 rounded-md border bg-muted/30 space-y-2" data-testid="ai-result">
                  <h3 className="font-semibold text-sm">AI Analysis</h3>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiAnalyzeMutation.data.content}</div>
                  {aiAnalyzeMutation.data.sources?.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Sources</p>
                      <div className="flex flex-wrap gap-1">
                        {aiAnalyzeMutation.data.sources.map((s: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Previous Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div key={rec.id} className="p-3 rounded-md border" data-testid={`recommendation-${i}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{rec.title}</p>
                        <Badge variant="secondary" className="text-xs capitalize">{rec.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">{rec.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
