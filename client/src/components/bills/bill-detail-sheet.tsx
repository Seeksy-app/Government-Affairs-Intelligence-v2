import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { Bell, Clock, ExternalLink, FolderOpen, Landmark, RefreshCw, Tag, Trash2, Users, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { BillChangeHistory, TrackedBill } from "@shared/schema";
import { isStateBill, jurisdictionName, normalizeTag, trackedBillLabel, trackedBillUrl } from "@shared/bill-label";
import { LegiScanAttribution } from "@/components/legiscan-attribution";
import { useBillActions } from "./use-bill-actions";

// "2025-06-20" → "Jun 20, 2025" without the UTC-midnight off-by-one that
// new Date("2025-06-20") causes in US time zones.
export function formatBillDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "MMM d, yyyy");
}

export function statusBadgeClass(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "passed":
    case "enrolled":
      return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800";
    case "vetoed":
    case "failed":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
    default:
      return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800";
  }
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Tag; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

export function BillDetailSheet({
  bill,
  focusTags,
  onClose,
  onRefresh,
  refreshing,
  onUntrack,
  onOpenAlerts,
}: {
  bill: TrackedBill | null;
  focusTags: boolean;
  onClose: () => void;
  onRefresh: (bill: TrackedBill) => void;
  refreshing: boolean;
  onUntrack: (bill: TrackedBill) => void;
  onOpenAlerts: (bill: TrackedBill) => void;
}) {
  const { portals, matters, isShared, toggleClient, setMatter, setTags } = useBillActions(bill, { loadAssignments: !!bill });
  const [tagInput, setTagInput] = useState("");
  const [confirmUntrack, setConfirmUntrack] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTagInput("");
    setConfirmUntrack(false);
    if (bill && focusTags) setTimeout(() => tagInputRef.current?.focus(), 150);
  }, [bill?.id, focusTags]);

  const { data: changes, isLoading: changesLoading } = useQuery<BillChangeHistory[]>({
    queryKey: ["/api/tracked-bills", bill?.id, "changes"],
    queryFn: async () => (await apiRequest("GET", `/api/tracked-bills/${bill!.id}/changes`)).json(),
    enabled: !!bill,
  });

  const tags = bill?.tags ?? [];
  const addTag = () => {
    const tag = normalizeTag(tagInput);
    if (!bill || !tag) return;
    if (!tags.includes(tag)) setTags([...tags, tag]);
    setTagInput("");
  };

  const state = bill ? isStateBill(bill) : false;

  return (
    <Sheet open={!!bill} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {bill && (
          <div className="space-y-6">
            <SheetHeader className="space-y-3 text-left">
              <div className="flex flex-wrap items-center gap-1.5 pr-6">
                <Badge variant="outline" className="text-sm font-semibold">{trackedBillLabel(bill)}</Badge>
                <Badge variant="secondary">{state ? jurisdictionName(bill) : "Federal"}</Badge>
                {bill.status && (
                  <Badge variant="outline" className={statusBadgeClass(bill.status)}>{bill.status}</Badge>
                )}
              </div>
              <SheetTitle className="text-lg leading-snug">{bill.title}</SheetTitle>
              <SheetDescription>
                {bill.sponsor
                  ? `Sponsored by ${bill.sponsor}${bill.sponsorParty ? ` (${bill.sponsorParty}${bill.sponsorState ? `-${bill.sponsorState}` : ""})` : ""}`
                  : "Sponsor not listed"}
              </SheetDescription>
            </SheetHeader>

            {bill.latestAction && (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3" /> Latest action{bill.latestActionDate ? ` · ${formatBillDate(bill.latestActionDate)}` : ""}
                </p>
                <p className="text-sm">{bill.latestAction}</p>
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Introduced</dt>
                <dd>{formatBillDate(bill.introducedDate) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Subject</dt>
                <dd>{bill.policyArea ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tracking since</dt>
                <dd>{bill.createdAt ? format(new Date(bill.createdAt), "MMM d, yyyy") : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last checked</dt>
                <dd>
                  {bill.lastSyncedAt
                    ? `${formatDistanceToNow(new Date(bill.lastSyncedAt))} ago`
                    : "Checked every 6 hours"}
                </dd>
              </div>
            </dl>

            <Section title="Clients" icon={Users}>
              {portals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No client portals yet. <Link href="/portals" className="text-primary hover:underline">Set one up</Link> to share bills with a client.
                </p>
              ) : (
                <div className="space-y-1">
                  {portals.map((portal) => (
                    <label key={portal.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer">
                      <Checkbox
                        checked={isShared(portal.id)}
                        onCheckedChange={() => toggleClient(portal)}
                        data-testid={`checkbox-client-${portal.id}`}
                      />
                      <span className="text-sm">{portal.name}</span>
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground px-2">Checked clients see this bill in their portal.</p>
                </div>
              )}
            </Section>

            <Section title="Research project" icon={FolderOpen}>
              <Select value={bill.matterId ?? "none"} onValueChange={(v) => setMatter(v === "none" ? null : v)}>
                <SelectTrigger data-testid="select-research-project">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {matters.map((matter) => (
                    <SelectItem key={matter.id} value={matter.id}>{matter.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Research projects group bills, documents, and research for one piece of work.{" "}
                <Link href="/matters" className="text-primary hover:underline">Manage projects</Link>
              </p>
            </Section>

            <Section title="Tags" icon={Tag}>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      #{tag}
                      <button
                        type="button"
                        className="rounded-sm opacity-60 hover:opacity-100"
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={tagInputRef}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag, e.g. veterans, q3-priority"
                  maxLength={40}
                  data-testid="input-add-tag"
                />
                <Button type="button" variant="outline" onClick={addTag} disabled={!tagInput.trim()}>
                  Add
                </Button>
              </div>
            </Section>

            <Section title="Activity" icon={Clock}>
              {changesLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : changes && changes.length > 0 ? (
                <ol className="border-l pl-4 space-y-3 ml-1">
                  {changes.map((change) => (
                    <li key={change.id} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" aria-hidden />
                      <p className="text-xs text-muted-foreground">
                        {change.detectedAt ? format(new Date(change.detectedAt), "MMM d, yyyy h:mm a") : ""}
                      </p>
                      <p>{change.description}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No changes detected since tracking started.</p>
              )}
            </Section>

            <Section title="Sources" icon={Landmark}>
              <div className="flex flex-col gap-1.5 text-sm">
                <a href={trackedBillUrl(bill)} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                  {state ? "Full bill on LegiScan" : "Full bill on Congress.gov"} <ExternalLink className="w-3 h-3" />
                </a>
                {state && bill.stateUrl && (
                  <a href={bill.stateUrl} target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">
                    {jurisdictionName(bill)} legislature page <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              {state && <LegiScanAttribution />}
            </Section>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => onRefresh(bill)} disabled={refreshing} data-testid="button-refresh-bill">
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Check for updates
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenAlerts(bill)}>
                <Bell className="w-4 h-4 mr-1.5" /> Alert settings
              </Button>
              <Button
                variant={confirmUntrack ? "destructive" : "ghost"}
                size="sm"
                className={confirmUntrack ? "" : "text-destructive hover:text-destructive"}
                onClick={() => (confirmUntrack ? onUntrack(bill) : setConfirmUntrack(true))}
                data-testid="button-untrack-bill"
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> {confirmUntrack ? "Click again to stop tracking" : "Stop tracking"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
