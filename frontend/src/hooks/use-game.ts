/**
 * The game whose pages are shown: the [game] segment of the URL
 */
import { useParams } from "next/navigation";
import useSWR from "swr";
import { gamesApi } from "@/lib/api";
import type { Game } from "@/lib/types";

const LAST_GAME_KEY = "nmt:last-game";

/** Game ID from the URL; "" outside game pages (e.g. Settings) */
export function useGame(): string {
  const params = useParams<{ game?: string }>();
  return params?.game ? decodeURIComponent(params.game) : "";
}

export function useGames() {
  const { data, error, isLoading } = useSWR<Game[]>("/api/games", gamesApi.list, {
    revalidateOnFocus: false,
  });
  return { games: data, isError: error, isLoading };
}

export function rememberGame(game: string) {
  try {
    localStorage.setItem(LAST_GAME_KEY, game);
  } catch {}
}

export function lastGame(): string | null {
  try {
    return localStorage.getItem(LAST_GAME_KEY);
  } catch {
    return null;
  }
}
