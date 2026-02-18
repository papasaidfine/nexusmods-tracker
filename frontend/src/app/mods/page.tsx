"use client";

import { useMods } from "@/hooks/use-mods";
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
        <AddModDialog onModAdded={() => mutate()} />
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
