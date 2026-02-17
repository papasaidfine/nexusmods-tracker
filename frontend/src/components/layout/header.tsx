"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updatesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export function Header() {
  const [checking, setChecking] = useState(false);

  async function handleCheckUpdates() {
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
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <div />
      <Button
        variant="outline"
        size="sm"
        onClick={handleCheckUpdates}
        disabled={checking}
      >
        <RefreshCw className={cn("size-4", checking && "animate-spin")} />
        {checking ? "Checking…" : "Check Updates"}
      </Button>
    </header>
  );
}
