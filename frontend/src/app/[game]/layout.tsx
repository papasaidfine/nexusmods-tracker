"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { rememberGame, useGame, useGames } from "@/hooks/use-game";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  const game = useGame();
  const { games } = useGames();
  const known = games?.some((g) => g.id === game);

  useEffect(() => {
    if (known) rememberGame(game);
  }, [game, known]);

  if (games && !known) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        <p>Unknown game &quot;{game}&quot;. Configured games are listed in backend/games.json.</p>
      </div>
    );
  }
  return children;
}
