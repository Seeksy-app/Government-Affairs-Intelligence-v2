import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, Network, Newspaper, TrendingUp, Activity } from "lucide-react";
import type { Client } from "@shared/schema";

interface Stats {
  totalClients: number;
  activeClients: number;
  totalUsers: number;
  totalContacts: number;
  totalNews: number;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentClients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/admin/clients/recent"],
  });

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    description,
    accent
  }: { 
    title: string; 
    value: number | undefined; 
    icon: any; 
    description?: string;
    accent?: "primary" | "green" | "blue" | "purple" | "orange";
  }) => {
    const accentStyles = {
      primary: "bg-primary/10 text-primary border-l-primary",
      green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-l-emerald-500",
      blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-l-blue-500",
      purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-l-purple-500",
      orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-l-orange-500",
    };
    const style = accent ? accentStyles[accent] : accentStyles.primary;
    const iconBg = style.split(" ").slice(0, 2).join(" ");
    const borderColor = style.split(" ").pop();

    return (
      <Card className={`border-l-4 ${borderColor} overflow-visible`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="text-3xl font-bold tracking-tight">{value ?? 0}</div>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-8">
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold font-serif" data-testid="text-admin-title">
          Platform Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your clients and monitor platform activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard 
          title="Total Clients" 
          value={stats?.totalClients} 
          icon={Building2}
          description="Licensed firms"
          accent="primary"
        />
        <StatCard 
          title="Active Clients" 
          value={stats?.activeClients} 
          icon={Activity}
          description="Currently active"
          accent="green"
        />
        <StatCard 
          title="Total Users" 
          value={stats?.totalUsers} 
          icon={Users}
          description="Across all clients"
          accent="blue"
        />
        <StatCard 
          title="Total Contacts" 
          value={stats?.totalContacts} 
          icon={Network}
          description="Political contacts"
          accent="purple"
        />
        <StatCard 
          title="News Articles" 
          value={stats?.totalNews} 
          icon={Newspaper}
          description="Aggregated articles"
          accent="orange"
        />
      </div>

      {/* Recent Clients */}
      <Card>
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Recent Clients
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {clientsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentClients && recentClients.length > 0 ? (
            <div className="space-y-2">
              {recentClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-4 p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`client-item-${client.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{client.name}</p>
                    <p className="text-sm text-muted-foreground">{client.industry || "Government Affairs"}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${client.isActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {client.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No clients yet</p>
              <p className="text-sm">Create your first client to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
