import { toast } from "sonner";
import { openUrlsInBatches } from "@/lib/utils";

/** Be gentle with Nexusmods: 5 pages 2s apart, then a 10s pause */
const DOWNLOAD_SCHEDULE = { batchSize: 5, intervalMs: 2000, batchPauseMs: 10000 };

const POPUP_HINT = "Allow pop-ups for this site (icon in the address bar) and try again.";

/** File page on Nexusmods; nmt=1 lets the tracker's userscript click "Slow download" */
export function getNexusmodsDownloadUrl(game: string, modId: number, fileId: number) {
  return `https://www.nexusmods.com/${game}/mods/${modId}?tab=files&file_id=${fileId}&nmt=1`;
}

/**
 * Open download pages in batches with a progress toast (with a Stop action).
 * Returns false if the browser blocked the first page.
 */
export function openDownloadPages(urls: string[]): boolean {
  const total = new Set(urls).size;
  const toastId = `download-${Date.now()}`;
  let warned = false;
  const progress = (count: number) =>
    count >= total
      ? toast.success(`Opened ${total} download page${total > 1 ? "s" : ""}`, {
          id: toastId,
          action: undefined,
        })
      : toast.loading(`Opening download pages ${count}/${total} (5 at a time)`, {
          id: toastId,
          action: { label: "Stop", onClick: () => stopAll() },
        });
  const stop = openUrlsInBatches(urls, DOWNLOAD_SCHEDULE, {
    onOpened: progress,
    onBlocked: () => {
      if (warned) return;
      warned = true;
      toast.warning(`Browser blocked some download pages. ${POPUP_HINT}`);
    },
  });
  if (!stop) {
    toast.warning(`Browser blocked the download page. ${POPUP_HINT}`);
    return false;
  }
  const stopAll = () => {
    stop();
    toast.info("Stopped opening download pages", { id: toastId });
  };
  return true;
}
