import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  FileText,
  Lightbulb,
  ListChecks,
  SearchCheck,
  ShieldAlert,
  Sigma,
  Target,
} from "lucide-react";
import { analyzeSymbolicLogic } from "@/lib/symbolic-logic/analyzer";
import { symbolicDemoSample } from "@/data/symbolic-demo-sample";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function findingTitle(item: any) {
  return item?.title || item?.label || item?.name || "Finding";
}

function findingText(item: any) {
  return item?.description || item?.detail || item?.text || item?.value || "";
}

function badgeVariantForImpact(impact?: string) {
  return impact === "negative" ? "destructive" : "secondary";
}

function conclusionBadgeVariant(type?: string) {
  return type === "threat" ? "destructive" : "secondary";
}

export default function SymbolicLogicDemoPage() {
  const [clientObjective, setClientObjective] = useState(symbolicDemoSample.clientObjective);
  const [clientProfile, setClientProfile] = useState(symbolicDemoSample.clientProfile);
  const [articleTitle, setArticleTitle] = useState(symbolicDemoSample.articleTitle);
  const [articleSource, setArticleSource] = useState(symbolicDemoSample.articleSource);
  const [articleText, setArticleText] = useState(symbolicDemoSample.articleText);
  const [hasAnalyzed, setHasAnalyzed] = useState(true);

  const result = useMemo(() => {
    if (!hasAnalyzed) return null;

    return analyzeSymbolicLogic({
      clientObjective,
      clientProfile,
      articleTitle,
      articleSource,
      articleText,
    });
  }, [hasAnalyzed, clientObjective, clientProfile, articleTitle, articleSource, articleText]);

  const confidence = result?.confidence ?? 0;
  const symbolCount = result?.detectedSymbols?.length ?? 0;
  const gapCount = result?.gapsOrContradictions?.length ?? 0;
  const assumptionCount = result?.assumptions?.length ?? 0;
  const actionCount = result?.recommendedActions?.length ?? 0;

  const topEvidence = result?.detectedSymbols?.flatMap((symbol) =>
    symbol.evidence.slice(0, 1).map((evidence) => ({
      symbol,
      evidence,
    }))
  ).slice(0, 4) ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/40 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">Symbolic Logic Intelligence Demo</h1>
            </div>
            <p className="text-muted-foreground max-w-3xl text-base">
              Convert government affairs content into claims, symbols, evidence, assumptions, gaps, and recommended client action.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={conclusionBadgeVariant(result?.conclusionType)} className="px-3 py-1">
              {(result?.conclusionType || "monitor").toUpperCase()}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1">
              {confidence}% Confidence
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Detected Symbols</p>
                  <p className="text-3xl font-bold">{symbolCount}</p>
                </div>
                <SearchCheck className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-3xl font-bold">{confidence}%</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={confidence} className="mt-3" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assumptions</p>
                  <p className="text-3xl font-bold">{assumptionCount}</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Gaps Found</p>
                  <p className="text-3xl font-bold">{gapCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Source Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Client Objective</label>
              <Textarea
                value={clientObjective}
                onChange={(e) => setClientObjective(e.target.value)}
                className="mt-1 min-h-[72px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Client Profile / Interest Area</label>
              <Textarea
                value={clientProfile}
                onChange={(e) => setClientProfile(e.target.value)}
                className="mt-1 min-h-[72px]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Article Title</label>
                <Input
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Source</label>
                <Input
                  value={articleSource}
                  onChange={(e) => setArticleSource(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Article / Press Release Text</label>
              <Textarea
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                className="mt-1 min-h-[240px]"
              />
            </div>

            <Button onClick={() => setHasAnalyzed(true)} className="w-full">
              Analyze Logic
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Client Takeaway
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={conclusionBadgeVariant(result?.conclusionType)} className="px-3 py-1">
                  {(result?.conclusionType || "monitor").toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">Confidence: {confidence}%</span>
              </div>

              <p className="text-lg leading-relaxed">{result?.conclusion}</p>

              <Separator />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold">Recommended Action</h3>
                </div>

                <ul className="space-y-2">
                  {result?.recommendedActions?.map((action, index) => (
                    <li key={index} className="flex gap-2 text-sm leading-relaxed">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sigma className="h-5 w-5" />
                Logic Chain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
                {result?.symbolicExpression}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {result?.detectedSymbols?.map((symbol, index) => (
                  <div key={symbol.id} className="flex items-center gap-2">
                    <Badge variant={badgeVariantForImpact(symbol.impact)}>
                      {symbol.id}
                    </Badge>
                    {index < symbolCount - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Symbol Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {result?.detectedSymbols?.map((symbol) => (
                  <div key={symbol.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{symbol.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{symbol.id}</p>
                      </div>
                      <Badge variant={badgeVariantForImpact(symbol.impact)}>
                        {symbol.impact}
                      </Badge>
                    </div>
                    {symbol.description && (
                      <p className="text-sm text-muted-foreground mt-2">{symbol.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="evidence" className="space-y-4">
        <TabsList>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
          <TabsTrigger value="gaps">Gaps</TabsTrigger>
        </TabsList>

        <TabsContent value="evidence">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Evidence Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                {result?.detectedSymbols?.map((symbol) => (
                  <div key={symbol.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">{symbol.label}</p>
                        <p className="text-xs text-muted-foreground">{symbol.id}</p>
                      </div>
                      <Badge variant={badgeVariantForImpact(symbol.impact)}>
                        {symbol.impact}
                      </Badge>
                    </div>

                    <ul className="space-y-2">
                      {symbol.evidence.map((item, index) => (
                        <li key={index} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Extracted Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {result?.extractedClaims?.map((claim, index) => (
                  <li key={index} className="rounded-lg border p-4">
                    <div className="flex gap-3">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <p className="leading-relaxed">{claim}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assumptions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Assumptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {result?.assumptions?.map((item: any, index: number) => (
                  <div key={index} className="rounded-lg border p-4">
                    <p className="font-semibold">{findingTitle(item)}</p>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{findingText(item)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Gaps / Contradictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gapCount > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {result?.gapsOrContradictions?.map((item: any, index: number) => (
                    <div key={index} className="rounded-lg border p-4">
                      <p className="font-semibold">{findingTitle(item)}</p>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{findingText(item)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                  No major gaps detected by the current local rules.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {topEvidence.length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle>Quick Review Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {topEvidence.map(({ symbol, evidence }, index) => (
                <div key={`${symbol.id}-${index}`} className="rounded-lg bg-background border p-3">
                  <p className="text-sm font-semibold">{symbol.label}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{evidence}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
