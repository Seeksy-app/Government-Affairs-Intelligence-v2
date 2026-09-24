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
import { AskBox } from "@/components/briefs/ask-box";
import { PageHeader, PageShell } from "@/components/page-header";

function StatusBadge({ status }: { status: string }) {
  if (status === "ready")
    return (
      <Badge className="border-transparent bg-emerald-50 text-emerald-700 shadow-none dark:bg-emerald-900/30 dark:text-emerald-300">
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
      <Badge className="border-transparent bg-destructive/10 text-destructive shadow-none">
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
    <PageShell className="space-y-8">
      <PageHeader
        eyebrow="Brief"
        title="Should I be worried?"
        description="Ask about a headline, a bill, or a link and get a calm, cited answer."
        className="mb-0"
        actions={
          <Link href="/briefs/new">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Brief from your own links
            </Button>
          </Link>
        }
      />

      <div className="max-w-3xl">
        <AskBox showHeading={false} />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Your briefs</h2>
      {isLoading ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-5 w-16 shrink-0" />
              <Skeleton className="hidden h-3 w-20 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      ) : !briefs || briefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold">No briefs yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask about a headline or bill above. Your briefs will be listed here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="hidden w-36 sm:table-cell">Updated</TableHead>
                <TableHead className="hidden w-20 text-center sm:table-cell">
                  <span className="sr-only">Views</span>
                  <Eye className="h-4 w-4 mx-auto text-muted-foreground" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {briefs.map((brief) => (
                <TableRow key={brief.id} className="hover:bg-muted/50 cursor-pointer group">
                  <TableCell>
                    <Link href={`/briefs/${brief.id}`} className="block min-w-0">
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
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {brief.updatedAt
                      ? formatDistanceToNow(new Date(brief.updatedAt), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden text-center text-sm text-muted-foreground sm:table-cell">
                    {brief.status === "ready" ? <ViewBadge briefId={brief.id} /> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      </section>
    </PageShell>
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
