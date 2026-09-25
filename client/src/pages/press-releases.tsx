import { useEffect, useState } from "react";
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
import { Newspaper, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import type { GovernmentPressRelease } from "@shared/schema";
import { PageHeader, PageShell } from "@/components/page-header";

interface ReleasesResponse {
  scope: "mine" | "all";
  hasMine: boolean;
  agencies: Array<{ slug: string; name: string; collected: boolean }>;
  releases: GovernmentPressRelease[];
}

const AGENCY_SHORT: Record<string, string> = {
  whitehouse: "White House",
  treasury: "Treasury",
};

function agencyLabel(slug: string) {
  return AGENCY_SHORT[slug] ?? slug.toUpperCase();
}

export default function PressReleasesPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  // Debounce typing into the server search.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching } = useQuery<ReleasesResponse>({
    queryKey: [q ? `/api/government-press/releases?q=${encodeURIComponent(q)}` : "/api/government-press/releases"],
    placeholderData: (prev) => prev,
  });

  const releases = data?.releases ?? [];
  const agencies = data?.agencies ?? [];
  const notCollected = agencies.filter((a) => !a.collected);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Monitor"
        title="Press Releases"
        description="The latest releases from the federal agencies your firm follows."
      >
        {agencies.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Following{" "}
            <span className="font-semibold text-foreground">
              {agencies.map((a) => agencyLabel(a.slug)).join(", ")}
            </span>
            {notCollected.length > 0 && (
              <> · {notCollected.map((a) => agencyLabel(a.slug)).join(", ")} not collected yet</>
            )}
          </p>
        )}
        {data?.scope === "all" && (
          <p className="text-sm text-muted-foreground">
            Showing every agency — add agencies to your firm profile to narrow this list.
          </p>
        )}
      </PageHeader>

      <div className="relative mb-4 max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search releases by keyword, program or place…"
          className="pl-9 pr-9"
          data-testid="input-search-press"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {q && !isFetching && (
        <p className="mb-3 text-sm text-muted-foreground" data-testid="text-press-results">
          {releases.length} result{releases.length === 1 ? "" : "s"} for “{q}”
        </p>
      )}

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
      ) : releases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Newspaper className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-sm font-semibold">
            {q ? `No releases match “${q}”` : "No releases from your agencies yet"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {q ? "Try a different word or clear the search." : "New releases are collected every few hours."}
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
                    {agencyLabel(r.departmentSlug)}
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
