/**
 * SWR hook for mods data
 */
import useSWR from "swr";
import { modsApi } from "@/lib/api";
import type { Mod } from "@/lib/types";
import { useGame } from "./use-game";

export const modsKey = (game: string) => `/api/games/${game}/mods`;

export function useMods() {
  const game = useGame();
  const { data, error, isLoading, mutate } = useSWR<Mod[]>(
    game ? modsKey(game) : null,
    () => modsApi.list(game),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    mods: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useMod(id: number | null) {
  const game = useGame();
  const { data, error, isLoading, mutate } = useSWR<Mod>(
    game && id ? `${modsKey(game)}/${id}` : null,
    () => modsApi.get(game, id!),
    {
      revalidateOnFocus: false,
    }
  );

  return {
    mod: data,
    isLoading,
    isError: error,
    mutate,
  };
}
