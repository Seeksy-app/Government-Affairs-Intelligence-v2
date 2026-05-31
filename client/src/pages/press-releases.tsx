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

export default function PressReleasesPage() {
  const { data: releases, isLoading } = useQuery<GovernmentPressRelease[]>({
    queryKey: ["/api/government-press/releases"],
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Newspaper className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold">Press Releases</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !releases || releases.length === 0 ? (
        <div className="text-center py-20">
          <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-1">No press releases yet</h2>
          <p className="text-sm text-muted-foreground">
            Press releases will appear here once ingestion runs.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Agency</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-36">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-xs font-medium uppercase text-muted-foreground">
                    {r.departmentSlug}
                  </TableCell>
                  <TableCell>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary transition-colors line-clamp-1"
                    >
                      {r.title}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
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
    </div>
  );
}
