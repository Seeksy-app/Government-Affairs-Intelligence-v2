import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ShieldCheck, ShieldAlert, Lock, Eye, FileCheck, CheckCircle } from "lucide-react";
import type { SecurityStatus, SecurityControl } from "@shared/schema";
import { PageHeader, PageShell } from "@/components/page-header";

const securityLevels = {
  basic: { label: "Basic", description: "Standard security measures in place", icon: Shield },
  standard: { label: "Standard", description: "Enhanced security with monitoring", icon: ShieldCheck },
  enhanced: { label: "Enhanced", description: "Advanced security with compliance", icon: ShieldCheck },
  enterprise: { label: "Enterprise", description: "Maximum security with full audit trail", icon: ShieldAlert },
};

export default function Security() {
  const { data, isLoading } = useQuery<{ status: SecurityStatus; controls: SecurityControl[] }>({
    queryKey: ["/api/security"],
  });

  const status = data?.status;
  const controls = data?.controls || [];

  const currentLevel = status?.level as keyof typeof securityLevels || "standard";
  const levelInfo = securityLevels[currentLevel];
  const LevelIcon = levelInfo?.icon || Shield;

  const enabledControls = controls.filter(c => c.status === "enabled");

  const summary = [
    { key: "access", label: "Access control", icon: Lock },
    { key: "encryption", label: "Encryption", icon: Shield },
    { key: "audit", label: "Audit", icon: Eye },
    { key: "compliance", label: "Compliance", icon: FileCheck },
  ] as const;

  const dataRights = [
    "Your data is encrypted at rest and in transit",
    "Access logs are maintained for audit purposes",
    "You can request data export or deletion at any time",
    "Multi-factor authentication available for enhanced security",
  ];

  const header = (
    <PageHeader
      eyebrow="Workspace"
      title="Security"
      description="See how your firm's data is protected and which security controls are in place."
      className="mb-0"
    />
  );

  if (isLoading) {
    return (
      <PageShell className="space-y-6">
        {header}
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg lg:col-span-2" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      {header}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LevelIcon className="h-4 w-4 text-muted-foreground" />
              Security level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-xl font-semibold">{levelInfo?.label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{levelInfo?.description}</p>
            {status?.notes && (
              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-sm">{status.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active security controls</CardTitle>
            <CardDescription>Security measures protecting your data</CardDescription>
          </CardHeader>
          <CardContent>
            {enabledControls.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-semibold">No active controls listed</p>
                <p className="mt-1 text-sm text-muted-foreground">Enabled security controls will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {enabledControls.map((control) => (
                  <div key={control.id} className="flex items-start gap-3 rounded-lg border p-3" data-testid={`control-${control.id}`}>
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{control.name}</p>
                      {control.description && <p className="text-sm text-muted-foreground">{control.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data protection summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {summary.map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate text-sm">{label}</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {controls.filter(c => c.category === key && c.status === "enabled").length}
                </p>
                <p className="text-xs text-muted-foreground">Active measures</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your data rights</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {dataRights.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageShell>
  );
}
