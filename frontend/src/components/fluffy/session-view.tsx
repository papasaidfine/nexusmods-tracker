"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fluffyApi } from "@/lib/api";
import type { FluffyReorderItem, FluffySession, FluffySessionMod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useGame } from "@/hooks/use-game";

interface SessionViewProps {
  session: FluffySession;
  onChange: () => void;
}

function StepIcon({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
  ) : (
    <CircleDashedIcon className="size-4 text-muted-foreground" />
  );
}

function ModPlan({ mod }: { mod: FluffySessionMod }) {
  const nothingInstalled = mod.matched.length === 0 && mod.removed.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StepIcon done={mod.done} />
          {mod.mod_name ?? mod.name}
          <span className="text-sm font-normal text-muted-foreground">
            {mod.old_version ?? "?"} → {mod.new_version ?? "?"}
          </span>
        </CardTitle>
        <CardDescription className="truncate" title={mod.new_archive}>
          {mod.old_archive} → {mod.new_archive}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {nothingInstalled ? (
          <p className="text-sm text-muted-foreground">
            No options installed in Fluffy; only the tracked file is updated.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Option</TableHead>
                <TableHead className="w-28">Old removed</TableHead>
                <TableHead className="w-28">New installed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mod.matched.map((m) => (
                <TableRow key={m.old.mod_id}>
                  <TableCell className="text-sm">{m.folder}</TableCell>
                  <TableCell><StepIcon done={!m.old_installed} /></TableCell>
                  <TableCell><StepIcon done={m.new_installed} /></TableCell>
                </TableRow>
              ))}
              {mod.removed.map((r) => (
                <TableRow key={r.old.mod_id} className="bg-amber-50/60 dark:bg-amber-950/20">
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <TriangleAlertIcon className="size-4 shrink-0 text-amber-600" />
                      {r.folder}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Not in the new version — pick a replacement in Fluffy
                    </div>
                  </TableCell>
                  <TableCell><StepIcon done={!r.old_installed} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">manual</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {mod.added.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">New options in this version: </span>
            {mod.added.map((a) => (
              <Badge key={a} variant="outline" className="mr-1 mb-1">
                {a}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReorderPlan({ items, update }: { items: FluffyReorderItem[]; update: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StepIcon done={items.every((r) => r.done)} />
          Install order
        </CardTitle>
        <CardDescription>
          {update
            ? "Reinstalled after the updated options, so they stay on top of them."
            : "Reinstalled in this order, so each goes on top of the part it changes."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Option</TableHead>
              <TableHead className="w-28">Reinstalled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.option.mod_id}>
                <TableCell className="text-sm">
                  <div>{r.folder}</div>
                  <div className="max-w-md truncate text-xs text-muted-foreground" title={r.archive ?? ""}>
                    {r.archive}
                  </div>
                </TableCell>
                <TableCell><StepIcon done={r.done} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function SessionView({ session, onChange }: SessionViewProps) {
  const game = useGame();
  const [cancelling, setCancelling] = useState(false);
  const finalizing = useRef(false);
  const reorder = session.reorder ?? [];
  const isUpdate = session.mods.length > 0;

  const allOptions = session.mods.flatMap((m) => [
    ...m.matched.map((o) => ({ oldGone: !o.old_installed, newIn: o.new_installed })),
    ...m.removed.map((o) => ({ oldGone: !o.old_installed, newIn: true })),
  ]).concat(
    // Reinstalled options keep their IDs; removal is only seen if polled in between
    reorder.map((r) => ({ oldGone: !!r.uninstall_seen || r.done, newIn: r.done }))
  );
  const uninstallDone = allOptions.every((o) => o.oldGone);
  const installDone = allOptions.every((o) => o.newIn);

  // Finalize automatically once Fluffy reports everything applied
  useEffect(() => {
    if (!session.done || finalizing.current) return;
    finalizing.current = true;
    fluffyApi
      .finalize(game)
      .then((result) => {
        toast.success(
          isUpdate
            ? `Updated ${result.updated.length} mod${result.updated.length === 1 ? "" : "s"}`
            : "Install order fixed"
        );
        for (const e of result.errors) toast.error(`Mod ${e.mod_db_id}: ${e.error}`);
        if (result.leftover_old_archives.length > 0) {
          toast.warning(
            `Could not delete ${result.leftover_old_archives.length} old archive(s); ` +
              "close Fluffy and delete them from the Mods folder"
          );
        }
      })
      .catch((e) => {
        finalizing.current = false;
        toast.error(e instanceof Error ? e.message : "Failed to finalize update");
      })
      .finally(onChange);
  }, [session.done, onChange, isUpdate, game]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await fluffyApi.cancel(game);
      toast.info("Cancelled; restart Fluffy to clear the presets from its list");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Apply in Fluffy</span>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
              <XIcon />
              {isUpdate ? "Cancel update" : "Cancel"}
            </Button>
          </CardTitle>
          <CardDescription>
            Open Mod presets in Fluffy and click each preset once. This page updates by itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {session.uninstall_preset && (
            <div className="flex items-center gap-2">
              <StepIcon done={uninstallDone} />
              1. Click <code className="rounded bg-muted px-1.5 py-0.5">{session.uninstall_preset}</code>{" "}
              {isUpdate ? "to uninstall the old options" : "to uninstall the options to reorder"}
            </div>
          )}
          {session.install_preset && (
            <div className="flex items-center gap-2">
              <StepIcon done={installDone} />
              2. Click <code className="rounded bg-muted px-1.5 py-0.5">{session.install_preset}</code>{" "}
              {isUpdate ? "to install the same options from the new version" : "to reinstall them in order"}
            </div>
          )}
          {session.done && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Finishing up...
            </div>
          )}
        </CardContent>
      </Card>
      {session.mods.map((mod) => (
        <ModPlan key={mod.mod_db_id} mod={mod} />
      ))}
      {reorder.length > 0 && <ReorderPlan items={reorder} update={isUpdate} />}
    </div>
  );
}
