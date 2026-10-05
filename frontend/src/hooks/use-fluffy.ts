/**
 * SWR hooks for the Fluffy Mod Manager update flow
 */
import useSWR from "swr";
import { fluffyApi } from "@/lib/api";
import type { FluffyCandidates, FluffySession } from "@/lib/types";

export function useFluffyCandidates() {
  const { data, error, mutate } = useSWR<FluffyCandidates>(
    "/api/fluffy/candidates",
    fluffyApi.candidates,
    // Picks up archives downloaded while the page is open
    { revalidateOnFocus: true }
  );
  return { candidates: data, isError: error, mutate };
}

export function useFluffySession() {
  const { data, mutate } = useSWR<FluffySession | null>(
    "/api/fluffy/session",
    fluffyApi.session,
    // Poll while an update is waiting for clicks in Fluffy
    { refreshInterval: (session) => (session ? 3000 : 0) }
  );
  return { session: data, mutate };
}
