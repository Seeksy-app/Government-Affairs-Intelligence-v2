import { useMemo, useState } from "react";
import { Brain, FileText, Lightbulb, Sigma, ShieldAlert } from "lucide-react";
import { analyzeSymbolicLogic } from "@/lib/symbolic-logic/analyzer";
import { symbolicDemoSample } from "@/data/symbolic-demo-sample";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Symbolic Logic Intelligence Demo</h1>
        </div>
        <p className="text-muted-foreground max-w-3xl">
          Turn government affairs content into structured claims, detected symbols, evidence, and an explainable conclusion.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Client Objective</label>
              <Textarea
                value={clientObjective}
                onChange={(e) => setClientObjective(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Client Profile / Interest Area</label>
              <Textarea
                value={clientProfile}
                onChange={(e) => setClientProfile(e.target.value)}
                className="mt-1 min-h-[80px]"
              />
            </div>

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

            <div>
              <label className="text-sm font-medium">Article / Press Release Text</label>
              <Textarea
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                className="mt-1 min-h-[220px]"
              />
            </div>

            <Button onClick={() => setHasAnalyzed(true)} className="w-full">
              Analyze Logic
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Conclusion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>{result?.conclusion}</p>
              <div className="text-sm text-muted-foreground">
                Confidence: {result?.confidence}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sigma className="h-5 w-5" />
                Symbolic Expression
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-4 font-mono text-sm whitespace-pre-wrap">
                {result?.symbolicExpression}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detected Symbols</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result?.detectedSymbols.map((symbol) => (
                  <Badge key={symbol.id} variant={symbol.impact === "negative" ? "destructive" : "secondary"}>
                    {symbol.id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extracted Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc pl-5">
              {result?.extractedClaims.map((claim, index) => (
                <li key={index}>{claim}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result?.detectedSymbols.map((symbol) => (
              <div key={symbol.id} className="space-y-2">
                <div className="font-semibold">{symbol.label}</div>
                <ul className="space-y-1 list-disc pl-5 text-sm text-muted-foreground">
                  {symbol.evidence.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
