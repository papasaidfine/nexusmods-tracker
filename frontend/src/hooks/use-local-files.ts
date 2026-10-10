/**
 * SWR hook for local files data
 */
import useSWR from "swr";
import { localFilesApi } from "@/lib/api";
import type { LocalFile } from "@/lib/types";
import { useGame } from "./use-game";

export function useLocalFiles() {
  const game = useGame();
  const { data, error, isLoading, mutate } = useSWR<LocalFile[]>(
    game ? `/api/games/${game}/local-files` : null,
    () => localFilesApi.list(game),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  return {
    files: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export async function scanDirectory(game: string) {
  try {
    const result = await localFilesApi.scan(game);
    return result;
  } catch (error) {
    throw error;
  }
}
