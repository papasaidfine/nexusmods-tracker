"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Plus,
  FolderSearch,
  Package,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updatesApi, localFilesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  onUpdatesChecked?: () => void;
  onScanComplete?: () => void;
}

export function QuickActions({ onUpdatesChecked, onScanComplete }: QuickActionsProps) {
  const router = useRouter();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [scanning, setScanning] = useState(false);

  async function handleCheckUpdates() {
    setCheckingUpdates(true);
    try {
      const updates = await updatesApi.checkAll();
      const withUpdates = updates.filter((u) => u.update_available);
      if (withUpdates.length > 0) {
        toast.info(`${withUpdates.length} update(s) available`);
      } else {
        toast.success("All mods are up to date");
      }
      onUpdatesChecked?.();
    } catch {
      toast.error("Failed to check for updates");
    } finally {
      setCheckingUpdates(false);
    }
  }

  async function handleScanFiles() {
    setScanning(true);
    try {
      const result = await localFilesApi.scan();
      toast.success(
        `Scan complete: ${result.total_files} files found (${result.unmapped_files} unmapped)`
      );
      onScanComplete?.();
    } catch {
      toast.error("Failed to scan directory");
    } finally {
      setScanning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks and shortcuts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3"
            onClick={handleCheckUpdates}
            disabled={checkingUpdates}
          >
            <RefreshCw
              className={cn("size-4 shrink-0", checkingUpdates && "animate-spin")}
            />
            <div className="text-left">
              <div className="text-sm font-medium">
                {checkingUpdates ? "Checking..." : "Check All Updates"}
              </div>
              <div className="text-xs text-muted-foreground">
                Verify all tracked mods
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3"
            onClick={handleScanFiles}
            disabled={scanning}
          >
            <FolderSearch
              className={cn("size-4 shrink-0", scanning && "animate-spin")}
            />
            <div className="text-left">
              <div className="text-sm font-medium">
                {scanning ? "Scanning..." : "Scan Local Files"}
              </div>
              <div className="text-xs text-muted-foreground">
                Detect new mod files
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3"
            onClick={() => router.push("/mods")}
          >
            <Package className="size-4 shrink-0" />
            <div className="text-left">
              <div className="text-sm font-medium">View All Mods</div>
              <div className="text-xs text-muted-foreground">
                Browse tracked mods
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 px-4 py-3"
            onClick={() => router.push("/local-files")}
          >
            <FolderOpen className="size-4 shrink-0" />
            <div className="text-left">
              <div className="text-sm font-medium">Manage Local Files</div>
              <div className="text-xs text-muted-foreground">
                Map files to mods
              </div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
