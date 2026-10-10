"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { fluffyApi } from "@/lib/api";
import { useMods } from "@/hooks/use-mods";
import { useFluffyCandidates, useFluffySession, useInstallOrder } from "@/hooks/use-fluffy";
import { useGame } from "@/hooks/use-game";
import { SessionView } from "@/components/fluffy/session-view";
import { InstallOrderCard } from "@/components/fluffy/install-order-card";
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
import { Layers2Icon, Loader2Icon, PackageCheckIcon, RefreshCwIcon } from "lucide-react";

export default function ModsPage() {
  const game = useGame();
  const { mods, isLoading, isError, mutate } = useMods();
  const { candidates, mutate: mutateCandidates } = useFluffyCandidates();
  const { session, mutate: mutateSession } = useFluffySession();
  const [orderRequested, setOrderRequested] = useState(false);
  const {
    installOrder,
    checking: checkingOrder,
    mutate: mutateInstallOrder,
  } = useInstallOrder(orderRequested);
  const [preparing, setPreparing] = useState(false);
  const [fixingOrder, setFixingOrder] = useState(false);

  const fluffy = useMemo(
    () => new Map(candidates?.candidates.map((c) => [c.mod_db_id, c]) ?? []),
    [candidates]
  );
  const installedCounts = useMemo(
    () => new Map(Object.entries(candidates?.installed_counts ?? {}).map(([id, n]) => [Number(id), n])),
    [candidates]
  );
  const downloaded = candidates?.candidates.filter((c) => c.new_archive) ?? [];
  // e.g. an older Fluffy whose files don't record archives and option IDs
  const fluffyError = candidates?.fluffy_error;

  const refreshAll = useCallback(() => {
    mutate();
    mutateCandidates();
    mutateSession();
    mutateInstallOrder();
  }, [mutate, mutateCandidates, mutateSession, mutateInstallOrder]);

  const handleFluffyUpdate = async (modDbIds: number[]) => {
    const items = modDbIds
      .map((id) => fluffy.get(id))
      .filter((c) => c?.new_archive)
      .map((c) => ({ mod_db_id: c!.mod_db_id, new_archive: c!.new_archive! }));
    if (items.length === 0) return;
    setPreparing(true);
    try {
      const session = await fluffyApi.prepare(game, items);
      if (session.warning) toast.warning(session.warning);
      else toast.success("Presets ready; apply them in Fluffy");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to prepare update");
    } finally {
      setPreparing(false);
      refreshAll();
    }
  };

  const handleFixOrder = async () => {
    setFixingOrder(true);
    try {
      const session = await fluffyApi.fixOrder(game);
      if (session.warning) toast.warning(session.warning);
      else toast.success("Presets ready; apply them in Fluffy");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to prepare the fix");
    } finally {
      setFixingOrder(false);
      refreshAll();
    }
  };

  const fluffyBusy = preparing || fixingOrder || !!session;

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
          {fluffyError && (
            <p className="text-xs text-muted-foreground mt-1">
              Fluffy features are off for this game: {fluffyError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!fluffyError && (<>
          <Button
            variant="outline"
            onClick={() => handleFluffyUpdate(downloaded.map((c) => c.mod_db_id))}
            disabled={fluffyBusy || downloaded.length === 0}
            title="Swap every downloaded update into Fluffy, keeping the installed options"
          >
            {preparing ? <Loader2Icon className="animate-spin" /> : <PackageCheckIcon />}
            {preparing ? "Preparing (Fluffy may restart)..." : `Update in Fluffy (${downloaded.length})`}
          </Button>
          <Button
            variant="outline"
            onClick={() => (orderRequested ? mutateInstallOrder() : setOrderRequested(true))}
            disabled={checkingOrder}
            title="Find addons and physics options installed before the part they change"
          >
            {checkingOrder ? <Loader2Icon className="animate-spin" /> : <Layers2Icon />}
            Check install order
          </Button>
          </>)}
          <AddModDialog onModAdded={() => mutate()} />
        </div>
      </div>

      {session && <SessionView session={session} onChange={refreshAll} />}

      {orderRequested && !session && installOrder && (
        <InstallOrderCard
          installOrder={installOrder}
          busy={fluffyBusy}
          fixing={fixingOrder}
          onFix={handleFixOrder}
          onClose={() => setOrderRequested(false)}
        />
      )}

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
            installedCounts={installedCounts}
            fluffyBusy={fluffyBusy}
            onFluffyUpdate={handleFluffyUpdate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
