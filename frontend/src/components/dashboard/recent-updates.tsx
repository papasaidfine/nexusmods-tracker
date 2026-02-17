"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpCircle,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Mod } from "@/lib/types";

interface RecentUpdatesProps {
  mods: Mod[] | undefined;
  isLoading: boolean;
}

export function RecentUpdates({ mods, isLoading }: RecentUpdatesProps) {
  const modsWithUpdates = mods?.filter((m) => m.update_available) ?? [];
  const recentlyChecked = mods
    ?.filter((m) => m.last_checked)
    .sort(
      (a, b) =>
        new Date(b.last_checked!).getTime() - new Date(a.last_checked!).getTime()
    )
    .slice(0, 5);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-8 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpCircle className="size-5 text-emerald-500" />
          Updates Available
        </CardTitle>
        <CardDescription>
          {modsWithUpdates.length > 0
            ? `${modsWithUpdates.length} mod${modsWithUpdates.length !== 1 ? "s" : ""} have updates`
            : "All mods are up to date"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {modsWithUpdates.length > 0 ? (
          <div className="space-y-3">
            {modsWithUpdates.map((mod) => {
              const fileId = mod.latest_file_id ?? mod.file_id;
              return (
              <div
                key={mod.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/mods/${mod.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {mod.name || mod.local_file}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {mod.mod_name && <span>{mod.mod_name}</span>}
                    {mod.version && (
                      <>
                        <span className="text-border">|</span>
                        <span>v{mod.version}</span>
                      </>
                    )}
                    {mod.game && (
                      <>
                        <span className="text-border">|</span>
                        <span>{mod.game}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                    <ArrowUpCircle className="size-3" />
                    Update
                  </span>
                  <Button variant="outline" size="xs" asChild>
                    <a
                      href={`https://www.nexusmods.com/${mod.game}/mods/${mod.mod_id}?tab=files&file_id=${fileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="mb-2 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No updates available right now.
            </p>
          </div>
        )}

        {recentlyChecked && recentlyChecked.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-3 text-sm font-medium text-muted-foreground">
              Recently Checked
            </h4>
            <div className="space-y-2">
              {recentlyChecked.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="size-3.5 shrink-0 text-muted-foreground" />
                    <Link
                      href={`/mods/${mod.id}`}
                      className="truncate hover:underline"
                    >
                      {mod.name || mod.local_file}
                    </Link>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(mod.last_checked!), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
