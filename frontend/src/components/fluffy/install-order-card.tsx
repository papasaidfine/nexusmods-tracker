"use client";

import { useState } from "react";
import type { InstallOrder, InstallOrderIssue } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronDownIcon,
  ChevronRightIcon,
  Layers2Icon,
  Loader2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

interface InstallOrderCardProps {
  installOrder: InstallOrder;
  busy: boolean;
  fixing: boolean;
  onFix: () => void;
  onClose: () => void;
}

function IssueTable({ issues }: { issues: InstallOrderIssue[] }) {
  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Option</TableHead>
            <TableHead>Covered by (installed later)</TableHead>
            <TableHead className="w-20 text-right">Files</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.option.position}>
              <TableCell className="align-top">
                <div className="text-sm">{issue.option.section}</div>
                <div
                  className="max-w-md truncate text-xs text-muted-foreground"
                  title={issue.option.archive ?? ""}
                >
                  {issue.option.archive ?? "unknown archive"}
                </div>
              </TableCell>
              <TableCell className="align-top text-sm">
                {issue.overridden_by.map((w) => (
                  <div key={w.position}>{w.section}</div>
                ))}
              </TableCell>
              <TableCell className="align-top text-right">
                <span title={issue.files.join("\n")}>{issue.files.length}</span>
                {!issue.verified && (
                  <Badge
                    variant="outline"
                    className="ml-1"
                    title="Not compared with the game folder (archive isn't a zip or is missing)"
                  >
                    ?
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Section({
  title,
  issues,
  defaultOpen = false,
}: {
  title: string;
  issues: InstallOrderIssue[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium hover:underline"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        {title} ({issues.length})
      </button>
      {open && <IssueTable issues={issues} />}
    </div>
  );
}

/** Result of an install order check the user asked for */
export function InstallOrderCard({
  installOrder,
  busy,
  fixing,
  onFix,
  onClose,
}: InstallOrderCardProps) {
  const misordered = installOrder.issues.filter((i) => i.kind === "misordered");
  const overridden = installOrder.issues.filter((i) => i.kind === "overridden");
  const clean = misordered.length === 0 && overridden.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            {clean ? (
              <CheckCircle2Icon className="size-5 text-emerald-600" />
            ) : (
              <TriangleAlertIcon className="size-5 text-amber-600" />
            )}
            Install order
          </span>
          <span className="flex items-center gap-2">
            {misordered.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFix}
                disabled={busy}
                title="Reinstall these options in Fluffy so each goes on top of the part it changes"
              >
                {fixing ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <Layers2Icon />
                )}
                {fixing
                  ? "Preparing (Fluffy may restart)..."
                  : `Fix in Fluffy (${misordered.length})`}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} title="Close">
              <XIcon />
            </Button>
          </span>
        </CardTitle>
        <CardDescription>
          {clean && "No problems found. "}
          Fluffy copies options into the game folder in install order, so a
          later option that ships the same file wins.
          {misordered.length > 0 &&
            ` ${misordered.length} option${misordered.length === 1 ? "" : "s"} (addons, physics...) lost files ` +
              "to the part they change because the part was installed after them. " +
              "Fix reinstalls them on top; nothing changes unless you click it."}
          {!installOrder.game_dir_found &&
            " Game folder not found in Fluffy's config, so files weren't compared with the game."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section
          title="Installed before the part they change"
          issues={misordered}
          defaultOpen
        />
        <Section
          title="Fully replaced by another mod or variant (left as is)"
          issues={overridden}
        />
      </CardContent>
    </Card>
  );
}
