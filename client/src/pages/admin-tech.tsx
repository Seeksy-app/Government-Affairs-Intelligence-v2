import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cpu, CheckCircle2, XCircle, ExternalLink, Brain, Database, Globe, MessageSquare, Wrench, Server, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface ApiInfo {
  name: string;
  key: string;
  configured: boolean;
  category: string;
  description: string;
  docsUrl: string | null;
}

interface ApiStatusResponse {
  apis: ApiInfo[];
  summary: { total: number; configured: number; missing: number };
}

const categoryConfig: Record<string, { label: string; icon: typeof Brain }> = {
  ai: { label: "AI & Research", icon: Brain },
  data: { label: "Data & Intelligence", icon: Database },
  social: { label: "Social Media", icon: Globe },
  comms: { label: "Communications", icon: MessageSquare },
  tools: { label: "Collaboration Tools", icon: Wrench },
  infra: { label: "Infrastructure", icon: Server },
};

export default function AdminTech() {
  const { data, isLoading } = useQuery<ApiStatusResponse>({
    queryKey: ["/api/admin/tech/api-status"],
  });

  const apis = data?.apis || [];
  const summary = data?.summary;

  const grouped = apis.reduce<Record<string, ApiInfo[]>>((acc, api) => {
    if (!acc[api.category]) acc[api.category] = [];
    acc[api.category].push(api);
    return acc;
  }, {});

  const categoryOrder = ["ai", "data", "social", "comms", "tools", "infra"];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full" data-testid="admin-tech-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Cpu className="w-6 h-6 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Tech Stack</h1>
            <p className="text-sm text-muted-foreground">API integrations and platform infrastructure</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-refresh-status"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/tech/api-status"] })}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-apis">{summary.total}</p>
                <p className="text-sm text-muted-foreground">Total APIs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-configured-apis">{summary.configured}</p>
                <p className="text-sm text-muted-foreground">Connected</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-500/10">
                <XCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-missing-apis">{summary.missing}</p>
                <p className="text-sm text-muted-foreground">Not Configured</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {categoryOrder.map(cat => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        const config = categoryConfig[cat] || { label: cat, icon: Cpu };
        const CatIcon = config.icon;

        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <CatIcon className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{config.label}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map(api => (
                <Card key={api.key} data-testid={`card-api-${api.key}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" data-testid={`text-api-name-${api.key}`}>{api.name}</span>
                          {api.configured ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400" data-testid={`badge-status-${api.key}`}>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Connected
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 dark:text-orange-400" data-testid={`badge-status-${api.key}`}>
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Set
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{api.description}</p>
                        <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{api.key}</p>
                      </div>
                      {api.docsUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid={`button-docs-${api.key}`}
                        >
                          <a href={api.docsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
