import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { ClientProfile, FirmClient } from "@shared/schema";

export interface FirmSetup {
  firmName: string | null;
  profile: ClientProfile | null;
  clients: FirmClient[];
  onboarded: boolean;
  needsOnboarding: boolean;
}

// The firm's onboarding answers and its own clients. Errors (e.g. a super
// admin with no firm) resolve to "no data" rather than blocking the page.
export function useFirmSetup() {
  const { user } = useAuth();
  return useQuery<FirmSetup>({
    queryKey: ["/api/onboarding"],
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
