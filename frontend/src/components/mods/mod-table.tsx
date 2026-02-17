"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { modsApi } from "@/lib/api";
import { checkSingleUpdate } from "@/hooks/use-updates";
import { downloadsApi } from "@/lib/api";
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
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  RefreshCwIcon,
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
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
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

  const handleCheckUpdate = async (mod: Mod) => {
    setCheckingId(mod.id);
    try {
      const result = await checkSingleUpdate(mod.id);
      if (result.update_available) {
        toast.success(`Update available for ${mod.mod_name || `Mod ${mod.mod_id}`}: ${result.latest_version}`);
      } else {
        toast.info(`${mod.mod_name || `Mod ${mod.mod_id}`} is up to date`);
      }
      onMutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check for updates"
      );
    } finally {
      setCheckingId(null);
    }
  };

  const handleDownload = async (mod: Mod) => {
    setDownloadingId(mod.id);
    try {
      const result = await downloadsApi.downloadUpdate(mod.id);
      toast.success(`Downloaded: ${result.filename}`);
      onMutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="mod_name">Name</SortableHeader>
            <SortableHeader field="author">Author</SortableHeader>
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
          {sortedMods.map((mod) => (
            <TableRow key={mod.id}>
              <TableCell className="max-w-[240px]">
                <Link
                  href={`/mods/${mod.id}`}
                  className="hover:underline text-foreground font-medium block truncate"
                >
                  {mod.name || mod.local_file}
                </Link>
                <span className="text-xs text-muted-foreground block truncate" title={mod.mod_name ?? undefined}>
                  {mod.mod_name || `Mod ${mod.mod_id}`}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {mod.author || "—"}
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
                    <DropdownMenuItem asChild>
                      <a
                        href={getNexusmodsUrl(mod.game, mod.mod_id, mod.file_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLinkIcon />
                        Open on Nexusmods
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleCheckUpdate(mod)}
                      disabled={checkingId === mod.id}
                    >
                      {checkingId === mod.id ? (
                        <Loader2Icon className="animate-spin" />
                      ) : (
                        <RefreshCwIcon />
                      )}
                      Check for Updates
                    </DropdownMenuItem>
                    {mod.update_available && (
                      <DropdownMenuItem
                        onClick={() => handleDownload(mod)}
                        disabled={downloadingId === mod.id}
                      >
                        {downloadingId === mod.id ? (
                          <Loader2Icon className="animate-spin" />
                        ) : (
                          <DownloadIcon />
                        )}
                        Download Update
                      </DropdownMenuItem>
                    )}
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
