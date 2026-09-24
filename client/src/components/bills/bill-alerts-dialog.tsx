import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/api-errors";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrackedBill } from "@shared/schema";
import { trackedBillLabel } from "@shared/bill-label";

type AlertPrefs = {
  alertOnStatusChange: boolean;
  alertOnNewAction: boolean;
  alertOnAmendment: boolean;
  emailNotification: boolean;
};

const OPTIONS: Array<{ key: keyof AlertPrefs; label: string; hint: string }> = [
  { key: "alertOnNewAction", label: "New actions", hint: "Any new legislative action on the bill" },
  { key: "alertOnStatusChange", label: "Status changes", hint: "When the bill moves to a new stage" },
  { key: "alertOnAmendment", label: "Amendments", hint: "When new amendments are proposed" },
  { key: "emailNotification", label: "Email me", hint: "Send these alerts by email" },
];

// Bell on a bill card: notification settings only (organizing lives in the
// "+" menu and the detail panel). Shows the saved values, not defaults.
export function BillAlertsDialog({ bill, onClose }: { bill: TrackedBill | null; onClose: () => void }) {
  const { toast } = useToast();
  const key = ["/api/tracked-bills", bill?.id, "alerts"];

  const { data: prefs, isLoading } = useQuery<AlertPrefs>({
    queryKey: key,
    queryFn: async () => (await apiRequest("GET", `/api/tracked-bills/${bill!.id}/alerts`)).json(),
    enabled: !!bill,
  });

  const save = useMutation({
    mutationFn: async (update: Partial<AlertPrefs>) =>
      (await apiRequest("PATCH", `/api/tracked-bills/${bill!.id}/alerts`, update)).json(),
    onMutate: async (update) => {
      // Flip the switch immediately; roll back if the save fails.
      const previous = queryClient.getQueryData<AlertPrefs>(key);
      if (previous) queryClient.setQueryData(key, { ...previous, ...update });
      return { previous };
    },
    onError: (error: Error, _update, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast({ title: "Couldn't save alert setting", description: friendlyError(error), variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <Dialog open={!!bill} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alerts for {bill ? trackedBillLabel(bill) : ""}</DialogTitle>
          <DialogDescription>We check tracked bills every 6 hours and alert you when they move.</DialogDescription>
        </DialogHeader>
        <div className="divide-y">
          {OPTIONS.map(({ key: prefKey, label, hint }) => (
            <div key={prefKey} className="flex items-center justify-between gap-4 py-3">
              <Label htmlFor={`alert-${prefKey}`} className="flex flex-col gap-0.5 cursor-pointer">
                <span>{label}</span>
                <span className="text-xs text-muted-foreground font-normal">{hint}</span>
              </Label>
              {isLoading || !prefs ? (
                <Skeleton className="h-6 w-11 rounded-full" />
              ) : (
                <Switch
                  id={`alert-${prefKey}`}
                  checked={prefs[prefKey]}
                  onCheckedChange={(checked) => save.mutate({ [prefKey]: checked })}
                  data-testid={`switch-${prefKey}`}
                />
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
