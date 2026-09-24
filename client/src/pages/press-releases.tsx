import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper } from "lucide-react";
import { format } from "date-fns";
import type { GovernmentPressRelease } from "@shared/schema";
import { PageHeader, PageShell } from "@/components/page-header";

export default function PressReleasesPage() {
  const { data: releases, isLoading } = useQuery<GovernmentPressRelease[]>({
    queryKey: ["/api/government-press/releases"],
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitor"
        title="Press Releases"
        description="Monitor the latest releases from federal departments and agencies."
      />

      {isLoading ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-3 w-20 shrink-0 sm:block" />
            </div>
          ))}
        </div>
      ) : !releases || releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Newspaper className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">No press releases yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Press releases will appear here once ingestion runs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28 sm:w-36">Agency</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-32 text-right">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {r.departmentSlug}
                  </TableCell>
                  <TableCell>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="line-clamp-2 text-sm font-medium transition-colors hover:text-primary sm:line-clamp-1"
                    >
                      {r.title}
                    </a>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground">
                    {r.publishedAt
                      ? format(new Date(r.publishedAt), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}
