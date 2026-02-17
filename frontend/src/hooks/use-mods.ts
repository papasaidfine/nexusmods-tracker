/**
 * SWR hook for mods data
 */
import useSWR from "swr";
import { modsApi } from "@/lib/api";
import type { Mod } from "@/lib/types";

export function useMods() {
  const { data, error, isLoading, mutate } = useSWR<Mod[]>(
    "/api/mods",
    modsApi.list,
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
  const { data, error, isLoading, mutate } = useSWR<Mod>(
    id ? `/api/mods/${id}` : null,
    id ? () => modsApi.get(id) : null,
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
