/**
 * SWR hook for updates data
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { updatesApi } from "@/lib/api";
import type { CheckAllJob, UpdateInfo } from "@/lib/types";

export function useUpdates(autoCheck = false) {
  const { data, error, isLoading, mutate } = useSWR<UpdateInfo[]>(
    autoCheck ? "/api/updates/check" : null,
    updatesApi.checkAll,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Don't auto-fetch - user must manually trigger
      revalidateIfStale: false,
    }
  );

  return {
    updates: data,
    isLoading,
    isError: error,
    checkUpdates: mutate,
  };
}

export async function checkUpdatesManually() {
  try {
    const updates = await updatesApi.checkAll();
    return updates;
  } catch (error) {
    throw error;
  }
}

export async function checkSingleUpdate(id: number) {
  try {
    const update = await updatesApi.checkSingle(id);
    return update;
  } catch (error) {
    throw error;
  }
}

// The check-all job runs on the server; one shared poller (module-level, so several
// buttons don't each poll) shows its progress in a single toast.
let polling: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const TOAST_ID = "check-all-updates";

function finishedMessage(job: CheckAllJob) {
  const pending = `${job.pending ?? 0} update${job.pending === 1 ? "" : "s"} pending`;
  if (!job.total) return `No mods changed on Nexusmods since the last check; ${pending}`;
  return `Checked ${job.total} mod${job.total === 1 ? "" : "s"}, found ${job.updates ?? 0} update${job.updates === 1 ? "" : "s"}; ${pending}`;
}

function pollCheckAll(onDone: () => void): Promise<void> {
  if (polling) return polling;
  polling = (async () => {
    for (;;) {
      const job = await updatesApi.checkAllStatus();
      if (!job.running) {
        if (job.error) toast.error(`Update check failed: ${job.error}`, { id: TOAST_ID });
        else toast.success(finishedMessage(job), { id: TOAST_ID });
        return;
      }
      toast.loading(
        job.total ? `Checking updates ${job.checked}/${job.total}` : "Checking updates...",
        { id: TOAST_ID }
      );
      await new Promise((r) => setTimeout(r, 1000));
    }
  })()
    .catch(() => {
      toast.error("Lost track of the update check; it may still be running", { id: TOAST_ID });
    })
    .finally(() => {
      polling = null;
      notify();
      onDone();
    });
  notify();
  return polling;
}

/**
 * Start a background check of all mods and show its progress.
 * resume: pick up a check already running on the server (e.g. after a page reload).
 */
export function useCheckAllUpdates({ resume = false } = {}) {
  const { mutate } = useSWRConfig();
  const running = useSyncExternalStore(subscribe, () => polling !== null, () => false);

  const refresh = useCallback(() => {
    mutate("/api/mods");
    mutate("/api/fluffy/candidates");
  }, [mutate]);

  useEffect(() => {
    if (!resume) return;
    updatesApi
      .checkAllStatus()
      .then((job) => {
        if (job.running) pollCheckAll(refresh);
      })
      .catch(() => {});
  }, [resume, refresh]);

  const start = useCallback(async () => {
    try {
      await updatesApi.startCheckAll();
      pollCheckAll(refresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start update check");
    }
  }, [refresh]);

  return { running, start };
}
