"use client";

import { useState } from "react";
import { RefreshCwIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { modsApi, localFilesApi } from "@/lib/api";
import { useCheckAllUpdates } from "@/hooks/use-updates";
import { useGame, useGames } from "@/hooks/use-game";
import { modsKey } from "@/hooks/use-mods";
import { candidatesKey } from "@/hooks/use-fluffy";
import { armorKey } from "@/hooks/use-armor";

export function Header() {
  const game = useGame();
  const { games } = useGames();
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const { running: checking, start: handleCheckUpdates } = useCheckAllUpdates({ resume: true });

  const handleRefresh = async () => {
    setRefreshing(true);
    const messages: string[] = [];
    try {
      const detect = await localFilesApi.autoDetect(game);
      if (detect.updated > 0) {
        const names = detect.details.map(d => d.mod_name || d.new_file).join(", ");
        messages.push(`Auto-updated ${detect.updated} mod(s): ${names}`);
      }
      const cleanup = await modsApi.cleanup(game);
      if (cleanup.removed > 0) {
        messages.push(`Removed ${cleanup.removed} missing entry/entries`);
      }
      if (messages.length > 0) {
        toast.success(messages.join(". "));
      } else {
        toast.info("Everything is in sync");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setRefreshing(false);
      mutate(modsKey(game));
      mutate(candidatesKey(game));
      mutate(armorKey(game));
    }
  };

  if (!game) {
    return <header className="h-14 border-b border-border bg-background" />;
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h2 className="text-sm font-medium text-muted-foreground">
        {games?.find((g) => g.id === game)?.name ?? game}
      </h2>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckUpdates}
          disabled={checking}
        >
          {checking ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-4" />
          )}
          {checking ? "Checking..." : "Check Updates"}
        </Button>
      </div>
    </header>
  );
}
