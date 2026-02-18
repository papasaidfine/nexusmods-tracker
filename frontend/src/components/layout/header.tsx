"use client";

import { useState } from "react";
import { RefreshCwIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { modsApi, updatesApi, localFilesApi } from "@/lib/api";

export function Header() {
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    const messages: string[] = [];
    try {
      const detect = await localFilesApi.autoDetect();
      if (detect.updated > 0) {
        const names = detect.details.map(d => d.mod_name || d.new_file).join(", ");
        messages.push(`Auto-updated ${detect.updated} mod(s): ${names}`);
      }
      const cleanup = await modsApi.cleanup();
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
      mutate("/api/mods");
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const updates = await updatesApi.checkAll();
      const withUpdates = updates.filter((u) => u.update_available);
      if (withUpdates.length > 0) {
        toast.info(`${withUpdates.length} update(s) available`);
      } else {
        toast.success("All mods are up to date");
      }
    } catch {
      toast.error("Failed to check for updates");
    } finally {
      setChecking(false);
      mutate("/api/mods");
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div />
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
