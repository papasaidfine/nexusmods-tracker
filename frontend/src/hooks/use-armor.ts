/**
 * SWR hook for the armor view
 */
import useSWR from "swr";
import { armorApi } from "@/lib/api";
import type { ArmorOverview } from "@/lib/types";
import { useGame } from "./use-game";

export const armorKey = (game: string) => `/api/games/${game}/armor`;

export function useArmor() {
  const game = useGame();
  const { data, error, isLoading, mutate } = useSWR<ArmorOverview>(
    game ? armorKey(game) : null,
    () => armorApi.get(game),
    // installed.ini changes when the user (un)installs in Fluffy
    { revalidateOnFocus: true }
  );
  return { armor: data, isError: error, isLoading, mutate };
}
