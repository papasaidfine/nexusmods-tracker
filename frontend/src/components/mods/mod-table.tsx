"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { modsApi } from "@/lib/api";
import type { Mod } from "@/lib/types";
import { UpdateBadge } from "@/components/mods/update-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  EyeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  Trash2Icon,
} from "lucide-react";

interface ModTableProps {
  mods: Mod[];
  onMutate: () => void;
}

type SortField =
  | "mod_name"
  | "author"
  | "version"
  | "file_id"
  | "category_name"
  | "uploaded_time"
  | "last_checked"
  | "update_available";

type SortDirection = "asc" | "desc";

function getNexusmodsUrl(game: string, modId: number, fileId: number) {
  return `https://www.nexusmods.com/${game}/mods/${modId}?tab=files&file_id=${fileId}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function ModTable({ mods, onMutate }: ModTableProps) {
  const [sortField, setSortField] = useState<SortField>("mod_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Mod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedMods = [...mods].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "boolean") {
      return (Number(aVal) - Number(bVal)) * dir;
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * dir;
    }

    return String(aVal).localeCompare(String(bVal)) * dir;
  });

  // Group mods by mod_id, preserving sort order of first appearance
  const groupedMods: { modId: number; modName: string; author: string; game: string; files: Mod[] }[] = [];
  const groupIndex = new Map<number, number>();
  for (const mod of sortedMods) {
    const idx = groupIndex.get(mod.mod_id);
    if (idx !== undefined) {
      groupedMods[idx].files.push(mod);
    } else {
      groupIndex.set(mod.mod_id, groupedMods.length);
      groupedMods.push({
        modId: mod.mod_id,
        modName: mod.mod_name || `Mod ${mod.mod_id}`,
        author: mod.author || "—",
        game: mod.game,
        files: [mod],
      });
    }
  }

  const handleDownloadGroup = (group: { modId: number; game: string; files: Mod[] }) => {
    const updatable = group.files.filter((m) => m.update_available && m.latest_file_id);
    if (updatable.length === 0) {
      toast.info("No updates available to download");
      return;
    }
    for (const mod of updatable) {
      window.open(
        getNexusmodsUrl(mod.game, mod.mod_id, mod.latest_file_id!),
        "_blank"
      );
    }
    toast.success(`Opened ${updatable.length} download page${updatable.length > 1 ? "s" : ""}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await modsApi.delete(deleteTarget.id);
      toast.success(`Deleted ${deleteTarget.mod_name || `Mod ${deleteTarget.mod_id}`}`);
      setDeleteTarget(null);
      onMutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete mod"
      );
    } finally {
      setDeleting(false);
    }
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => {
    const isActive = sortField === field;
    return (
      <TableHead>
        <button
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => handleSort(field)}
        >
          {children}
          {isActive ? (
            sortDirection === "asc" ? (
              <ArrowUpIcon className="size-3" />
            ) : (
              <ArrowDownIcon className="size-3" />
            )
          ) : (
            <ArrowUpDownIcon className="size-3 opacity-40" />
          )}
        </button>
      </TableHead>
    );
  };

  if (mods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">No mods tracked yet</p>
        <p className="text-sm mt-1">
          Add a mod to start tracking updates from Nexusmods.
        </p>
      </div>
    );
  }

  const allCollapsed = groupedMods.length > 0 && collapsedGroups.size === groupedMods.length;

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsedGroups(new Set());
    } else {
      setCollapsedGroups(new Set(groupedMods.map((g) => g.modId)));
    }
  };

  return (
    <>
      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={toggleCollapseAll}>
          {allCollapsed ? (
            <ChevronsUpDownIcon className="size-4" />
          ) : (
            <ChevronsDownUpIcon className="size-4" />
          )}
          {allCollapsed ? "Expand All" : "Collapse All"}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="mod_name">File</SortableHeader>
            <SortableHeader field="version">Version</SortableHeader>
            <SortableHeader field="file_id">File ID</SortableHeader>
            <SortableHeader field="category_name">Category</SortableHeader>
            <SortableHeader field="uploaded_time">Uploaded</SortableHeader>
            <SortableHeader field="last_checked">Last Checked</SortableHeader>
            <SortableHeader field="update_available">Status</SortableHeader>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedMods.map((group) => (
            <Fragment key={`group-${group.modId}`}>
              {/* Mod group header */}
              <TableRow
                className="bg-muted/50 hover:bg-muted/50 cursor-pointer"
                onClick={() => setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.modId)) next.delete(group.modId);
                  else next.add(group.modId);
                  return next;
                })}
              >
                <TableCell colSpan={7} className="py-2">
                  <div className="flex items-center gap-2">
                    {collapsedGroups.has(group.modId) ? (
                      <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <a
                      href={`https://www.nexusmods.com/${group.game}/mods/${group.modId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {group.modName}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      by {group.author}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({group.files.length} file{group.files.length !== 1 ? "s" : ""})
                    </span>
                    {(() => {
                      const updatable = group.files.filter((m) => m.update_available).length;
                      if (updatable > 0) {
                        return (
                          <span className="text-xs font-medium text-orange-500">
                            {updatable}/{group.files.length} update{updatable !== 1 ? "s" : ""} available
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </TableCell>
                <TableCell className="text-right py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-xs">
                        <MoreHorizontalIcon />
                        <span className="sr-only">Group Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleDownloadGroup(group)}
                        disabled={!group.files.some((m) => m.update_available && m.latest_file_id)}
                      >
                        <DownloadIcon />
                        Download Updates
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              {/* File rows */}
              {!collapsedGroups.has(group.modId) && group.files.map((mod) => (
                <TableRow key={mod.id}>
                  <TableCell className="max-w-[240px] pl-6">
                    <Link
                      href={`/mods/${mod.id}`}
                      className="hover:underline text-foreground font-medium block truncate"
                    >
                      {mod.name || mod.local_file}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {mod.version || "—"}
                    </code>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {mod.file_id}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {mod.category_name || "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={mod.uploaded_time ? format(new Date(mod.uploaded_time), "PPpp") : undefined}
                  >
                    {formatDate(mod.uploaded_time)}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={mod.last_checked ? format(new Date(mod.last_checked), "PPpp") : undefined}
                  >
                    {formatRelativeDate(mod.last_checked)}
                  </TableCell>
                  <TableCell>
                    {mod.update_available && mod.latest_file_id ? (
                      <a
                        href={getNexusmodsUrl(mod.game, mod.mod_id, mod.latest_file_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <UpdateBadge updateAvailable={true} />
                      </a>
                    ) : (
                      <UpdateBadge updateAvailable={mod.update_available} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <MoreHorizontalIcon />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/mods/${mod.id}`}>
                            <EyeIcon />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(mod)}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Mod</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop tracking{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.mod_name || `Mod ${deleteTarget?.mod_id}`}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2Icon className="animate-spin" />}
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
