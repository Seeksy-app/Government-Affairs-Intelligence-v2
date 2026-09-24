import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/api-errors";
import type { ClientPortal, Matter, PortalTrackedBill, TrackedBill } from "@shared/schema";

// Organizing actions for one tracked bill — assign to a client (client
// portal), a research project (matter), and tags. Shared by the card's "+"
// menu and the bill detail panel so both stay in sync.
export function useBillActions(bill: TrackedBill | null, { loadAssignments }: { loadAssignments: boolean }) {
  const { toast } = useToast();

  const { data: portals = [] } = useQuery<ClientPortal[]>({ queryKey: ["/api/portals"] });
  const { data: matters = [] } = useQuery<Matter[]>({ queryKey: ["/api/matters"] });

  const assignmentsKey = ["/api/tracked-bills", bill?.id, "portals"];
  const { data: assignments = [] } = useQuery<PortalTrackedBill[]>({
    queryKey: assignmentsKey,
    queryFn: async () => (await apiRequest("GET", `/api/tracked-bills/${bill!.id}/portals`)).json(),
    enabled: !!bill && loadAssignments,
  });

  const onError = (title: string) => (error: Error) =>
    toast({ title, description: friendlyError(error), variant: "destructive" });

  const toggleClient = useMutation({
    mutationFn: async (portal: ClientPortal) => {
      const assignment = assignments.find((a) => a.portalId === portal.id);
      if (assignment) {
        await apiRequest("DELETE", `/api/tracked-bills/${bill!.id}/portals/${assignment.id}`);
        return { portal, shared: false };
      }
      await apiRequest("POST", `/api/tracked-bills/${bill!.id}/portals`, { portalId: portal.id });
      return { portal, shared: true };
    },
    onSuccess: ({ portal, shared }) => {
      toast({ title: shared ? `Shared with ${portal.name}` : `Removed from ${portal.name}` });
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
    },
    onError: onError("Couldn't update client"),
  });

  const updateBill = useMutation({
    mutationFn: async (updates: { matterId?: string | null; tags?: string[] }) =>
      (await apiRequest("PATCH", `/api/tracked-bills/${bill!.id}`, updates)).json() as Promise<TrackedBill>,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tracked-bills"] }),
    onError: onError("Couldn't update bill"),
  });

  const setMatter = (matterId: string | null) =>
    updateBill.mutate(
      { matterId },
      {
        onSuccess: () => {
          const name = matters.find((m) => m.id === matterId)?.name;
          toast({ title: name ? `Added to "${name}"` : "Removed from research project" });
        },
      },
    );

  const setTags = (tags: string[]) => updateBill.mutate({ tags });

  return {
    portals,
    matters,
    assignments,
    isShared: (portalId: string) => assignments.some((a) => a.portalId === portalId),
    toggleClient: (portal: ClientPortal) => toggleClient.mutate(portal),
    setMatter,
    setTags,
    busy: toggleClient.isPending || updateBill.isPending,
  };
}
