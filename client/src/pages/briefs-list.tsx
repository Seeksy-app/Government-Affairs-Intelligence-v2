import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText, Plus, Clock, CheckCircle, XCircle, Loader2, Eye,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Brief } from "@shared/schema";

function StatusBadge({ status }: { status: string }) {
  if (status === "ready")
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Ready
      </Badge>
    );
  if (status === "generating")
    return (
      <Badge variant="secondary">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Generating
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  return (
    <Badge variant="outline">
      <Clock className="h-3 w-3 mr-1" />
      Draft
    </Badge>
  );
}

export default function BriefsList() {
  const { data: briefs, isLoading } = useQuery<Brief[]>({
    queryKey: ["/api/briefs"],
    refetchInterval: (query) => {
      const data = query.state.data as Brief[] | undefined;
      return data?.some((b) => b.status === "generating") ? 5000 : false;
    },
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold">Decision Briefs</h1>
        </div>
        <Link href="/briefs/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Brief
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !briefs || briefs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-1">No briefs yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first AI-generated decision brief.
          </p>
          <Link href="/briefs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Brief
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-36">Updated</TableHead>
                <TableHead className="w-20 text-center">
                  <span className="sr-only">Views</span>
                  <Eye className="h-4 w-4 mx-auto text-muted-foreground" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.map((brief) => (
                <TableRow key={brief.id} className="hover:bg-muted/50 cursor-pointer group">
                  <TableCell>
                    <Link href={`/briefs/${brief.id}`} className="block">
                      <span className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                        {brief.title}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {brief.sensitivity}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={brief.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {brief.updatedAt
                      ? formatDistanceToNow(new Date(brief.updatedAt), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {brief.status === "ready" ? <ViewBadge briefId={brief.id} /> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function ViewBadge({ briefId }: { briefId: string }) {
  const { data } = useQuery<unknown[]>({
    queryKey: [`/api/briefs/${briefId}/views`],
    staleTime: 60_000,
  });
  const count = data?.length ?? 0;
  return <span>{count > 0 ? count : "—"}</span>;
}
