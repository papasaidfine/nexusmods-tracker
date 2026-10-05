"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { fluffyApi } from "@/lib/api";
import { useMods } from "@/hooks/use-mods";
import { useFluffyCandidates, useFluffySession } from "@/hooks/use-fluffy";
import { SessionView } from "@/components/fluffy/session-view";
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
import { Loader2Icon, PackageCheckIcon, RefreshCwIcon } from "lucide-react";

export default function ModsPage() {
  const { mods, isLoading, isError, mutate } = useMods();
  const { candidates, mutate: mutateCandidates } = useFluffyCandidates();
  const { session, mutate: mutateSession } = useFluffySession();
  const [preparing, setPreparing] = useState(false);

  const fluffy = useMemo(
    () => new Map(candidates?.candidates.map((c) => [c.mod_db_id, c]) ?? []),
    [candidates]
  );
  const downloaded = candidates?.candidates.filter((c) => c.new_archive) ?? [];

  const refreshAll = useCallback(() => {
    mutate();
    mutateCandidates();
    mutateSession();
  }, [mutate, mutateCandidates, mutateSession]);

  const handleFluffyUpdate = async (modDbIds: number[]) => {
    const items = modDbIds
      .map((id) => fluffy.get(id))
      .filter((c) => c?.new_archive)
      .map((c) => ({ mod_db_id: c!.mod_db_id, new_archive: c!.new_archive! }));
    if (items.length === 0) return;
    setPreparing(true);
    try {
      const session = await fluffyApi.prepare(items);
      if (session.warning) toast.warning(session.warning);
      else toast.success("Presets ready; apply them in Fluffy");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to prepare update");
    } finally {
      setPreparing(false);
      refreshAll();
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
            onClick={() => handleFluffyUpdate(downloaded.map((c) => c.mod_db_id))}
            disabled={preparing || !!session || downloaded.length === 0}
            title="Swap every downloaded update into Fluffy, keeping the installed options"
          >
            {preparing ? <Loader2Icon className="animate-spin" /> : <PackageCheckIcon />}
            {preparing ? "Preparing (Fluffy may restart)..." : `Update in Fluffy (${downloaded.length})`}
          </Button>
          <AddModDialog onModAdded={() => mutate()} />
        </div>
      </div>

      {session && <SessionView session={session} onChange={refreshAll} />}

      <Card>
        <CardHeader>
          <CardTitle>Mod Library</CardTitle>
          <CardDescription>
            All your tracked Nexusmods modifications with version and update information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModTable
            mods={mods ?? []}
            onMutate={refreshAll}
            fluffy={fluffy}
            fluffyBusy={preparing || !!session}
            onFluffyUpdate={handleFluffyUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
