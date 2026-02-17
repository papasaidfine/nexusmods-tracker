"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMods } from "@/hooks/use-mods";
import { updatesApi } from "@/lib/api";
import { ModTable } from "@/components/mods/mod-table";
import { AddModDialog } from "@/components/mods/add-mod-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";

export default function ModsPage() {
  const { mods, isLoading, isError, mutate } = useMods();
  const [checkingAll, setCheckingAll] = useState(false);

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const results = await updatesApi.checkAll();
      const updatesFound = results.filter((r) => r.update_available).length;
      if (updatesFound > 0) {
        toast.success(`Found ${updatesFound} update${updatesFound > 1 ? "s" : ""} available`);
      } else {
        toast.info("All mods are up to date");
      }
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check for updates"
      );
    } finally {
      setCheckingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive font-medium">Failed to load mods</p>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCwIcon />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tracked Mods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mods?.length ?? 0} mod{(mods?.length ?? 0) !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleCheckAll}
            disabled={checkingAll || !mods?.length}
          >
            {checkingAll ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            {checkingAll ? "Checking..." : "Check All Updates"}
          </Button>
          <AddModDialog onModAdded={() => mutate()} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mod Library</CardTitle>
          <CardDescription>
            All your tracked Nexusmods modifications with version and update information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModTable mods={mods ?? []} onMutate={() => mutate()} />
        </CardContent>
      </Card>
    </div>
  );
}
