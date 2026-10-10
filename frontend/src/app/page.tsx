"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2Icon } from "lucide-react";
import { lastGame, useGames } from "@/hooks/use-game";

/** Open the last used game (or the first configured one) */
export default function HomePage() {
  const router = useRouter();
  const { games, isError } = useGames();

  useEffect(() => {
    if (!games?.length) return;
    const last = lastGame();
    const game = games.find((g) => g.id === last) ?? games[0];
    router.replace(`/${game.id}`);
  }, [games, router]);

  if (isError || games?.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <p>
          {isError
            ? "Failed to connect to the backend. Make sure the server is running on localhost:8000."
            : "No games configured. Add your Fluffy game folders to backend/games.json."}
        </p>
      </div>
    );
  }
  return <Loader2Icon className="size-5 animate-spin text-muted-foreground" />;
}
