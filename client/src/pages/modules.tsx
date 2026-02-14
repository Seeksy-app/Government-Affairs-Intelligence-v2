import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, BookOpen, Puzzle, Check, X, RefreshCw, BarChart3 } from "lucide-react";
import type { PlatformModule, ClientModule } from "@shared/schema";

interface UserRole {
  isSuperAdmin: boolean;
  clientId?: string;
  clientName?: string;
  impersonatingClientId?: string;
  impersonatingClientName?: string;
}

const moduleIcons: Record<string, any> = {
  Trophy,
  BookOpen,
  Puzzle,
  BarChart3,
};

export default function ModulesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: userRole } = useQuery<UserRole>({
    queryKey: ["/api/user/role"],
    enabled: !!user,
  });

  const effectiveClientId = userRole?.isSuperAdmin && userRole?.impersonatingClientId
    ? userRole.impersonatingClientId
    : userRole?.clientId;

  const { data: allModules, isLoading: modulesLoading, error: modulesError, refetch: refetchModules } = useQuery<PlatformModule[]>({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const res = await fetch("/api/modules", { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      const data = await res.json();
      return data;
    },
    enabled: !!user,
    staleTime: 0,
    retry: 2,
  });

  const { data: clientModules, isLoading: clientModulesLoading } = useQuery<(ClientModule & { module: PlatformModule })[]>({
    queryKey: ["/api/clients", effectiveClientId, "modules"],
    queryFn: async () => {
      if (!effectiveClientId) return [];
      const res = await fetch(`/api/clients/${effectiveClientId}/modules`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch client modules");
      return res.json();
    },
    enabled: !!effectiveClientId,
  });

  const enabledModuleIds = new Set(
    (clientModules || []).filter(cm => cm.enabled).map(cm => cm.moduleId)
  );

  const toggleModuleMutation = useMutation({
    mutationFn: async ({ moduleId, enable }: { moduleId: string; enable: boolean }) => {
      const action = enable ? "enable" : "disable";
      const res = await apiRequest("POST", `/api/clients/${effectiveClientId}/modules/${moduleId}/${action}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", effectiveClientId, "modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/check/sports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/check/legistorm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules/check/marketing_intelligence"] });
      toast({ title: "Module updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update module", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = modulesLoading || clientModulesLoading;
  const activeModules = (allModules || []).filter(m => m.isActive);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-modules-title">
          <Puzzle className="h-7 w-7" />
          Modules
        </h1>
        <p className="text-muted-foreground mt-1">
          Enable or disable add-on modules for your firm. Each module unlocks additional features and capabilities.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : activeModules.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {activeModules.map((mod) => {
            const isEnabled = enabledModuleIds.has(mod.id);
            const IconComponent = moduleIcons[mod.icon || "Puzzle"] || Puzzle;

            return (
              <Card key={mod.id} data-testid={`card-module-${mod.key}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{mod.name}</CardTitle>
                      <Badge variant={isEnabled ? "default" : "secondary"} className="mt-1 text-xs">
                        {isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => toggleModuleMutation.mutate({ moduleId: mod.id, enable: checked })}
                    disabled={toggleModuleMutation.isPending}
                    data-testid={`switch-module-${mod.key}`}
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{mod.description}</p>
                  {mod.category && (
                    <Badge variant="outline" className="mt-3 text-xs">{mod.category}</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : modulesError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <X className="h-12 w-12 text-destructive" />
            <p className="text-muted-foreground">Failed to load modules.</p>
            <Button variant="outline" onClick={() => refetchModules()} data-testid="button-retry-modules">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No modules available yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
