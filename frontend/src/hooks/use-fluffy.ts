/**
 * SWR hooks for the Fluffy Mod Manager update flow
 */
import useSWR from "swr";
import { fluffyApi } from "@/lib/api";
import type { FluffyCandidates, FluffySession, InstallOrder } from "@/lib/types";
import { useGame } from "./use-game";

export const candidatesKey = (game: string) => `/api/games/${game}/fluffy/candidates`;

export function useFluffyCandidates() {
  const game = useGame();
  const { data, error, mutate } = useSWR<FluffyCandidates>(
    game ? candidatesKey(game) : null,
    () => fluffyApi.candidates(game),
    // Picks up archives as the browser finishes downloading them
    { revalidateOnFocus: true, refreshInterval: 10000 }
  );
  return { candidates: data, isError: error, mutate };
}

export function useFluffySession() {
  const game = useGame();
  const { data, mutate } = useSWR<FluffySession | null>(
    game ? `/api/games/${game}/fluffy/session` : null,
    () => fluffyApi.session(game),
    // Poll while an update is waiting for clicks in Fluffy
    { refreshInterval: (session) => (session ? 3000 : 0) }
  );
  return { session: data, mutate };
}

/** Only runs once requested: the user's own install order stands unless they ask */
export function useInstallOrder(requested: boolean) {
  const game = useGame();
  const { data, error, isValidating, mutate } = useSWR<InstallOrder>(
    game && requested ? `/api/games/${game}/fluffy/install-order` : null,
    () => fluffyApi.installOrder(game),
    // The backend caches the check until installed.ini changes
    { revalidateOnFocus: false }
  );
  return { installOrder: data, isError: error, checking: isValidating, mutate };
}
