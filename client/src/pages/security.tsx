import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert, Lock, Eye, FileCheck, CheckCircle } from "lucide-react";
import type { SecurityStatus, SecurityControl } from "@shared/schema";

const securityLevels = {
  basic: { label: "Basic", color: "bg-yellow-500", description: "Standard security measures in place", icon: Shield },
  standard: { label: "Standard", color: "bg-blue-500", description: "Enhanced security with monitoring", icon: ShieldCheck },
  enhanced: { label: "Enhanced", color: "bg-green-500", description: "Advanced security with compliance", icon: ShieldCheck },
  enterprise: { label: "Enterprise", color: "bg-purple-500", description: "Maximum security with full audit trail", icon: ShieldAlert },
};

export default function Security() {
  const { data } = useQuery<{ status: SecurityStatus; controls: SecurityControl[] }>({
    queryKey: ["/api/security"],
  });

  const status = data?.status;
  const controls = data?.controls || [];

  const currentLevel = status?.level as keyof typeof securityLevels || "standard";
  const levelInfo = securityLevels[currentLevel];
  const LevelIcon = levelInfo?.icon || Shield;

  const enabledControls = controls.filter(c => c.status === "enabled");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Security & Compliance</h1>
          <p className="text-muted-foreground">Your data protection and security status</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LevelIcon className="w-5 h-5" />
              Security Level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${levelInfo?.color}`} />
              <span className="text-xl font-bold">{levelInfo?.label}</span>
            </div>
            <p className="text-muted-foreground">{levelInfo?.description}</p>
            {status?.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">{status.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Active Security Controls</CardTitle>
            <CardDescription>Security measures protecting your data</CardDescription>
          </CardHeader>
          <CardContent>
            {enabledControls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Lock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active security controls</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {enabledControls.map((control) => (
                  <div key={control.id} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`control-${control.id}`}>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">{control.name}</p>
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
        <CardHeader>
          <CardTitle>Data Protection Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Access Control</span>
              </div>
              <p className="text-2xl font-bold">{controls.filter(c => c.category === "access" && c.status === "enabled").length}</p>
              <p className="text-sm text-muted-foreground">Active measures</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-green-500" />
                <span className="font-medium">Encryption</span>
              </div>
              <p className="text-2xl font-bold">{controls.filter(c => c.category === "encryption" && c.status === "enabled").length}</p>
              <p className="text-sm text-muted-foreground">Active measures</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-5 h-5 text-orange-500" />
                <span className="font-medium">Audit</span>
              </div>
              <p className="text-2xl font-bold">{controls.filter(c => c.category === "audit" && c.status === "enabled").length}</p>
              <p className="text-sm text-muted-foreground">Active measures</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Compliance</span>
              </div>
              <p className="text-2xl font-bold">{controls.filter(c => c.category === "compliance" && c.status === "enabled").length}</p>
              <p className="text-sm text-muted-foreground">Active measures</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Data Rights</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Your data is encrypted at rest and in transit
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Access logs are maintained for audit purposes
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              You can request data export or deletion at any time
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Multi-factor authentication available for enhanced security
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
