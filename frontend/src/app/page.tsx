"use client";

import { useMods } from "@/hooks/use-mods";
import { useLocalFiles } from "@/hooks/use-local-files";
import { StatsOverview } from "@/components/dashboard/stats-card";
import { RecentUpdates } from "@/components/dashboard/recent-updates";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const { mods, isLoading: modsLoading, isError: modsError, mutate: mutateMods } = useMods();
  const { files, isLoading: filesLoading, isError: filesError, mutate: mutateFiles } = useLocalFiles();

  const isLoading = modsLoading || filesLoading;
  const hasError = modsError || filesError;

  const totalMods = mods?.length ?? 0;
  const updatesAvailable = mods?.filter((m) => m.update_available).length ?? 0;
  const totalFiles = files?.length ?? 0;
  const unmappedFiles = files?.filter((f) => !f.mapped).length ?? 0;

  function handleUpdatesChecked() {
    mutateMods();
  }

  function handleScanComplete() {
    mutateFiles();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your mod tracking status
        </p>
      </div>

      {hasError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <p>
            Failed to connect to the backend. Make sure the server is running on{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              localhost:8000
            </code>
            .
          </p>
        </div>
      )}

      <StatsOverview
        totalMods={totalMods}
        updatesAvailable={updatesAvailable}
        totalFiles={totalFiles}
        unmappedFiles={unmappedFiles}
        isLoading={isLoading}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentUpdates mods={mods} isLoading={modsLoading} />
        <QuickActions
          onUpdatesChecked={handleUpdatesChecked}
          onScanComplete={handleScanComplete}
        />
      </div>
    </div>
  );
}
