/**
 * SWR hook for updates data
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { updatesApi } from "@/lib/api";
import type { CheckAllJob } from "@/lib/types";
import { useGame } from "./use-game";
import { modsKey } from "./use-mods";
import { candidatesKey } from "./use-fluffy";

export async function checkSingleUpdate(game: string, id: number) {
  try {
    const update = await updatesApi.checkSingle(game, id);
    return update;
  } catch (error) {
    throw error;
  }
}

// The check-all job runs on the server, one per game; one shared poller per game
// (module-level, so several buttons don't each poll) shows its progress in a toast.
const polling = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const toastId = (game: string) => `check-all-updates:${game}`;

function finishedMessage(job: CheckAllJob) {
  const pending = `${job.pending ?? 0} update${job.pending === 1 ? "" : "s"} pending`;
  if (!job.total) return `No mods changed on Nexusmods since the last check; ${pending}`;
  return `Checked ${job.total} mod${job.total === 1 ? "" : "s"}, found ${job.updates ?? 0} update${job.updates === 1 ? "" : "s"}; ${pending}`;
}

function pollCheckAll(game: string, onDone: () => void): Promise<void> {
  const running = polling.get(game);
  if (running) return running;
  const id = toastId(game);
  const poll = (async () => {
    for (;;) {
      const job = await updatesApi.checkAllStatus(game);
      if (!job.running) {
        if (job.error) toast.error(`Update check failed: ${job.error}`, { id });
        else toast.success(finishedMessage(job), { id });
        return;
      }
      toast.loading(
        job.total ? `Checking updates ${job.checked}/${job.total}` : "Checking updates...",
        { id }
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  })()
    .catch(() => {
      toast.error("Lost track of the update check; it may still be running", { id });
    })
    .finally(() => {
      polling.delete(game);
      notify();
      onDone();
    });
  polling.set(game, poll);
  notify();
  return poll;
}

/**
 * Start a background check of all mods and show its progress.
 * resume: pick up a check already running on the server (e.g. after a page reload).
 */
export function useCheckAllUpdates({ resume = false } = {}) {
  const game = useGame();
  const { mutate } = useSWRConfig();
  const running = useSyncExternalStore(subscribe, () => polling.has(game), () => false);

  const refresh = useCallback(() => {
    mutate(modsKey(game));
    mutate(candidatesKey(game));
  }, [mutate, game]);

  useEffect(() => {
    if (!resume || !game) return;
    updatesApi
      .checkAllStatus(game)
      .then((job) => {
        if (job.running) pollCheckAll(game, refresh);
      })
      .catch(() => {});
  }, [resume, game, refresh]);

  const start = useCallback(async () => {
    try {
      await updatesApi.startCheckAll(game);
      pollCheckAll(game, refresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start update check");
    }
  }, [game, refresh]);

  return { running, start };
}
