import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Building2, ExternalLink, Landmark, Loader2, RefreshCw, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/api-errors";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { OrgProfile } from "@shared/schema";

const KIND_LABEL: Record<string, string> = {
  company: "Company",
  trade_association: "Trade association",
  nonprofit: "Nonprofit",
  congressional_office: "Congressional office",
  committee: "Congressional committee",
  federal_agency: "Federal agency",
  state_or_local_government: "State or local government",
  other: "Organization",
};
const hostOf = (u: string) => {
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
const hrefOf = (u: string) => (u.startsWith("http") ? u : `https://${u}`);

// Side panel with a researched profile of a contact's organization. Shows the
// saved copy instantly (free); researching new or refreshing costs ~2¢.
export function OrgProfileSheet({ name, open, onOpenChange }: { name: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const key = ["/api/org-profile", name];
  const { data, isLoading } = useQuery<{ profile: OrgProfile | null }>({
    queryKey: key,
    queryFn: async () => (await apiRequest("GET", `/api/org-profile?name=${encodeURIComponent(name ?? "")}`)).json(),
    enabled: open && !!name,
  });
  const research = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/org-profile", { name })).json() as Promise<{ profile: OrgProfile }>,
    onSuccess: (r) => queryClient.setQueryData(key, r),
    onError: (err: Error) => toast({ title: "Couldn't build the profile", description: friendlyError(err), variant: "destructive" }),
  });

  const p = data?.profile?.data;
  const Icon = p?.kind === "congressional_office" || p?.kind === "committee" || p?.kind === "federal_agency" ? Landmark : Building2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl" data-testid="sheet-org-profile">
        <SheetHeader className="mb-5 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Organization profile</p>
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            {p?.officialName || name}
          </SheetTitle>
          {p && (
            <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{KIND_LABEL[p.kind] ?? "Organization"}</span>
              {p.sector && <span>{p.sector}</span>}
              {p.website && (
                <a href={hrefOf(p.website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {hostOf(p.website)} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </SheetDescription>
          )}
        </SheetHeader>

        {isLoading || research.isPending ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" />
            {research.isPending ? "Researching… this can take up to a minute." : "Loading…"}
          </div>
        ) : !p ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm font-semibold">No profile yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll research what {name} does, who leads it, its lobbying and policy activity, and recent news.
            </p>
            <Button className="mt-4" onClick={() => research.mutate()} data-testid="button-build-org-profile">
              <Search className="h-4 w-4" /> Build profile
            </Button>
          </div>
        ) : !p.found ? (
          <div className="rounded-lg border p-5 text-sm">
            <p className="font-semibold">We couldn't pin down which organization this is.</p>
            <p className="mt-1 text-muted-foreground">Try editing the contact's organization to its full name, then look again.</p>
          </div>
        ) : (
          <div className="space-y-6 text-sm">
            <p className="leading-relaxed">{p.summary}</p>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/20 p-4">
              {[
                ["Headquarters", p.headquarters],
                ["Size", p.size],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5">{v}</dd>
                  </div>
                ))}
              {!!p.leaders.length && (
                <div className="col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leadership</dt>
                  <dd className="mt-1 space-y-0.5">
                    {p.leaders.map((l) => (
                      <p key={l.name}>
                        <span className="font-medium">{l.name}</span>
                        {l.title && <span className="text-muted-foreground"> · {l.title}</span>}
                      </p>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            {p.governmentAffairs && (
              <section>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide">Lobbying and policy activity</h3>
                <p className="leading-relaxed">{p.governmentAffairs}</p>
              </section>
            )}

            {!!p.policyAreas.length && (
              <div className="flex flex-wrap gap-1.5">
                {p.policyAreas.map((a) => (
                  <span key={a} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {a}
                  </span>
                ))}
              </div>
            )}

            {!!p.recentDevelopments.length && (
              <section>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide">Recent developments</h3>
                <ul className="space-y-2.5">
                  {p.recentDevelopments.map((r) => (
                    <li key={r.url + r.headline} className="border-l-2 border-primary/40 pl-3">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-primary hover:underline">
                        {r.headline}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        {r.date} · {hostOf(r.url)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!!p.sources.length && (
              <section className="border-t pt-3">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide">Sources</h3>
                <ul className="space-y-0.5 text-xs">
                  {p.sources.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {hostOf(u)}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {data?.profile && !research.isPending && (
          <div className="mt-6 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Researched {formatDistanceToNow(new Date(data.profile.fetchedAt), { addSuffix: true })}</span>
            <Button variant="ghost" size="sm" onClick={() => research.mutate()} data-testid="button-refresh-org-profile">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
