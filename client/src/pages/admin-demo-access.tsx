import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, Clock, Users, Trash2, Search, ArrowUpDown, Mail, Video } from "lucide-react";
import type { DemoAccessLog } from "@shared/schema";

function formatTimeSpent(seconds: number | null): string {
  if (!seconds || seconds === 0) return "\u2014";
  if (seconds < 60) return `0:${seconds.toString().padStart(2, "0")}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}:${secs.toString().padStart(2, "0")}`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}:${remMins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }) + ", " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type SortField = "email" | "sessionStart" | "timeSpentSeconds" | "videosViewed" | "videosCompleted";
type SortDirection = "asc" | "desc";

export default function AdminDemoAccess() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("sessionStart");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: logs, isLoading } = useQuery<DemoAccessLog[]>({
    queryKey: ["/api/admin/demo-access-logs"],
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/admin/demo-access-logs");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-access-logs"] });
      toast({ title: "Access logs cleared" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear logs", description: error.message, variant: "destructive" });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredLogs = (logs || []).filter(log =>
    !searchQuery || log.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "sessionStart":
        comparison = new Date(a.sessionStart || 0).getTime() - new Date(b.sessionStart || 0).getTime();
        break;
      case "timeSpentSeconds":
        comparison = (a.timeSpentSeconds || 0) - (b.timeSpentSeconds || 0);
        break;
      case "videosViewed":
        comparison = (a.videosViewed || 0) - (b.videosViewed || 0);
        break;
      case "videosCompleted":
        comparison = (a.videosCompleted || 0) - (b.videosCompleted || 0);
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const uniqueEmails = new Set((logs || []).map(l => l.email)).size;
  const totalTime = (logs || []).reduce((sum, l) => sum + (l.timeSpentSeconds || 0), 0);
  const avgTime = logs?.length ? Math.round(totalTime / logs.length) : 0;

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="text-left py-3 px-4 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3.5 h-3.5 ${sortField === field ? "text-primary" : "text-muted-foreground/40"}`} />
      </div>
    </th>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-demo-access-title">Demo Access Log</h1>
            <p className="text-muted-foreground text-sm">{logs?.length || 0} sessions recorded</p>
          </div>
        </div>
        {(logs?.length || 0) > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Clear all access logs? This cannot be undone.")) {
                clearMutation.mutate();
              }
            }}
            disabled={clearMutation.isPending}
            data-testid="button-clear-logs"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Logs
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-sessions">{logs?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-unique-emails">{uniqueEmails}</p>
                <p className="text-sm text-muted-foreground">Unique Visitors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-avg-time">{formatTimeSpent(avgTime)}</p>
                <p className="text-sm text-muted-foreground">Avg. Time Spent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-views">
                  {(logs || []).reduce((sum, l) => sum + (l.videosViewed || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Video Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-logs"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      )}

      {!isLoading && sortedLogs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Eye className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery ? "No sessions match your search." : "No demo sessions recorded yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && sortedLogs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-access-logs">
                <thead>
                  <tr className="border-b">
                    <SortableHeader field="email">Email</SortableHeader>
                    <SortableHeader field="sessionStart">Date</SortableHeader>
                    <SortableHeader field="timeSpentSeconds">Time Spent</SortableHeader>
                    <SortableHeader field="videosViewed">Videos Viewed</SortableHeader>
                    <SortableHeader field="videosCompleted">Videos Completed</SortableHeader>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/50 transition-colors" data-testid={`row-log-${log.id}`}>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium" data-testid={`text-email-${log.id}`}>{log.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">{formatDate(log.sessionStart as any)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono">{formatTimeSpent(log.timeSpentSeconds)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{log.videosViewed || 0}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Video className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{log.videosCompleted || 0}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
