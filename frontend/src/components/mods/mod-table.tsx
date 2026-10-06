"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { modsApi, updatesApi } from "@/lib/api";
import { cn, openUrlsInBatches, parseServerDate } from "@/lib/utils";
import type { FluffyCandidate, Mod } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  CircleCheckIcon,
  DownloadIcon,
  EyeIcon,
  RefreshCwIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PackageCheckIcon,
  SearchIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";

interface ModTableProps {
  mods: Mod[];
  onMutate: () => void;
  /** Fluffy update readiness per mod DB id (only mods with a pending update) */
  fluffy?: Map<number, FluffyCandidate>;
  /** Options installed in Fluffy per mod DB id */
  installedCounts?: Map<number, number>;
  fluffyBusy?: boolean;
  onFluffyUpdate?: (modDbIds: number[]) => void;
}

type SortField =
  | "mod_name"
  | "author"
  | "version"
  | "category_name"
  | "uploaded_time"
  | "last_checked"
  | "update_available";

type SortDirection = "asc" | "desc";

/** Workflow views: what the user is doing rather than raw columns */
type View = "all" | "installed" | "updates" | "downloaded";

const VIEWS: { key: View; label: string; hint: string }[] = [
  { key: "all", label: "All", hint: "Every tracked file" },
  { key: "installed", label: "In Fluffy", hint: "Files with options installed in Fluffy" },
  { key: "updates", label: "Updates", hint: "Files with a newer version on Nexusmods" },
  { key: "downloaded", label: "Ready", hint: "Updates downloaded and ready for Update in Fluffy" },
];

interface ModGroup {
  modId: number;
  modName: string;
  author: string;
  game: string;
  files: Mod[];
}

interface AuthorGroup {
  author: string;
  mods: ModGroup[];
  files: Mod[];
}

const UNKNOWN_AUTHOR = "Unknown author";

/** Be gentle with Nexusmods: 5 pages 2s apart, then a 10s pause */
const DOWNLOAD_SCHEDULE = { batchSize: 5, intervalMs: 2000, batchPauseMs: 10000 };

/** File page on Nexusmods; nmt=1 lets the tracker's userscript click "Slow download" */
function getNexusmodsDownloadUrl(game: string, modId: number, fileId: number) {
  return `https://www.nexusmods.com/${game}/mods/${modId}?tab=files&file_id=${fileId}&nmt=1`;
}

function formatRelativeDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(parseServerDate(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Compact counts shown on author and mod rows */
function GroupSummary({ updates, ready, installed }: { updates: number; ready: number; installed: number }) {
  return (
    <span className="flex items-center gap-2 text-xs">
      {updates > 0 && (
        <span className="font-medium text-amber-600 dark:text-amber-400">
          {updates} update{updates !== 1 ? "s" : ""}
        </span>
      )}
      {ready > 0 && (
        <span className="font-medium text-emerald-600 dark:text-emerald-400">{ready} ready</span>
      )}
      {installed > 0 && <span className="text-muted-foreground">{installed} in Fluffy</span>}
    </span>
  );
}

export function ModTable({
  mods,
  onMutate,
  fluffy,
  installedCounts,
  fluffyBusy,
  onFluffyUpdate,
}: ModTableProps) {
  const isDownloaded = (m: Mod) => !!(m.update_available && fluffy?.get(m.id)?.new_archive);
  const installedOf = (m: Mod) => installedCounts?.get(m.id) ?? 0;
  const downloadedIds = (files: Mod[]) => files.filter(isDownloaded).map((m) => m.id);
  const sumInstalled = (files: Mod[]) => files.reduce((n, m) => n + installedOf(m), 0);
  const matchesView = (m: Mod, v: View) =>
    v === "all" ||
    (v === "installed" && installedOf(m) > 0) ||
    (v === "updates" && m.update_available) ||
    (v === "downloaded" && isDownloaded(m));

  const [sortField, setSortField] = useState<SortField>("mod_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // Mod groups whose expansion differs from the default (same rule as authors)
  const [toggledGroups, setToggledGroups] = useState<Set<number>>(new Set());
  // Authors whose expansion differs from the default (collapsed normally,
  // expanded while searching so matches are visible).
  const [toggledAuthors, setToggledAuthors] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Mod | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("all");
  // While searching or viewing a subset, groups open by default so matches are visible
  const filtering = search !== "" || view !== "all";

  // Filtering flips the default expansion; reset manual toggles when it starts or stops
  const applyFilters = (nextSearch: string, nextView: View) => {
    if ((nextSearch !== "" || nextView !== "all") !== filtering) {
      setToggledAuthors(new Set());
      setToggledGroups(new Set());
    }
    setSearch(nextSearch);
    setView(nextView);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const searchLower = search.toLowerCase();
  const searchedMods = search
    ? mods.filter((m) => {
        return (
          (m.name && m.name.toLowerCase().includes(searchLower)) ||
          (m.mod_name && m.mod_name.toLowerCase().includes(searchLower)) ||
          (m.local_file && m.local_file.toLowerCase().includes(searchLower)) ||
          (m.author && m.author.toLowerCase().includes(searchLower)) ||
          (m.version && m.version.toLowerCase().includes(searchLower))
        );
      })
    : mods;

  const viewCounts = Object.fromEntries(
    VIEWS.map((v) => [v.key, searchedMods.filter((m) => matchesView(m, v.key)).length])
  ) as Record<View, number>;
  const filteredMods = searchedMods.filter((m) => matchesView(m, view));

  const sortedMods = [...filteredMods].sort((a, b) => {
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
  const groupedMods: ModGroup[] = [];
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
        author: mod.author || UNKNOWN_AUTHOR,
        game: mod.game,
        files: [mod],
      });
    }
  }

  // Group mod groups by author. Authors are ordered alphabetically (direction
  // follows the Author column when it is the active sort); mods within an
  // author keep the table's sort order.
  const authorMap = new Map<string, AuthorGroup>();
  for (const group of groupedMods) {
    let authorGroup = authorMap.get(group.author);
    if (!authorGroup) {
      authorGroup = { author: group.author, mods: [], files: [] };
      authorMap.set(group.author, authorGroup);
    }
    authorGroup.mods.push(group);
    authorGroup.files.push(...group.files);
  }
  const authorDir = sortField === "author" && sortDirection === "desc" ? -1 : 1;
  const authorGroups = [...authorMap.values()].sort((a, b) => {
    if (a.author === UNKNOWN_AUTHOR) return 1;
    if (b.author === UNKNOWN_AUTHOR) return -1;
    return a.author.localeCompare(b.author, undefined, { sensitivity: "base" }) * authorDir;
  });

  const isAuthorExpanded = (author: string) => filtering !== toggledAuthors.has(author);

  const toggleAuthor = (author: string) => {
    setToggledAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(author)) next.delete(author);
      else next.add(author);
      return next;
    });
  };

  const isGroupExpanded = (modId: number) => filtering !== toggledGroups.has(modId);

  const toggleModGroup = (modId: number) => {
    setToggledGroups((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const toDownload = (files: Mod[]) =>
    files.filter((m) => m.update_available && m.latest_file_id && !isDownloaded(m));

  const handleDownloadGroup = (group: { files: Mod[] }) => {
    const updatable = toDownload(group.files);
    if (updatable.length === 0) {
      toast.info("No updates available to download");
      return;
    }
    const urls = updatable.map((mod) => getNexusmodsDownloadUrl(mod.game, mod.mod_id, mod.latest_file_id!));
    const popupHint = "Allow pop-ups for this site (icon in the address bar) and try again.";
    const total = new Set(urls).size;
    const toastId = `download-${Date.now()}`;
    let warned = false;
    const progress = (count: number) =>
      count >= total
        ? toast.success(`Opened ${total} download page${total > 1 ? "s" : ""}`, {
            id: toastId,
            action: undefined,
          })
        : toast.loading(`Opening download pages ${count}/${total} (5 at a time)`, {
            id: toastId,
            action: { label: "Stop", onClick: () => stopAll() },
          });
    const stop = openUrlsInBatches(urls, DOWNLOAD_SCHEDULE, {
      onOpened: progress,
      onBlocked: () => {
        if (warned) return;
        warned = true;
        toast.warning(`Browser blocked some download pages. ${popupHint}`);
      },
    });
    if (!stop) {
      toast.warning(`Browser blocked the download page. ${popupHint}`);
      return;
    }
    const stopAll = () => {
      stop();
      toast.info("Stopped opening download pages", { id: toastId });
    };
  };

  const handleCheckFile = async (mod: Mod) => {
    try {
      const result = await updatesApi.checkSingle(mod.id);
      if (result.update_available) {
        toast.success(`Update available for ${mod.name || mod.local_file}`);
      } else {
        toast.info(`${mod.name || mod.local_file} is up to date`);
      }
      onMutate();
    } catch {
      toast.info(`${mod.name || mod.local_file} is up to date`);
      onMutate();
    }
  };

  const handleCheckGroup = async (group: { files: Mod[] }) => {
    let updates = 0;
    for (const mod of group.files) {
      try {
        const result = await updatesApi.checkSingle(mod.id);
        if (result.update_available) updates++;
      } catch {
        // no update
      }
    }
    if (updates > 0) {
      toast.success(`${updates} update${updates > 1 ? "s" : ""} found`);
    } else {
      toast.info("All files up to date");
    }
    onMutate();
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

  const allCollapsed =
    authorGroups.length > 0 && authorGroups.every((g) => !isAuthorExpanded(g.author));

  const toggleCollapseAll = () => {
    // Collapsing: every author folds to the default state when not searching,
    // or is toggled off when searching. Expanding does the inverse. Mod groups
    // go back to their default either way, so expanding lists mods, not files.
    const wantExpanded = allCollapsed;
    const defaultExpanded = filtering;
    setToggledAuthors(
      wantExpanded === defaultExpanded
        ? new Set()
        : new Set(authorGroups.map((g) => g.author))
    );
    setToggledGroups(new Set());
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <div className="relative w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search mods..."
            value={search}
            onChange={(e) => applyFilters(e.target.value, view)}
            className="pl-9 h-8"
          />
        </div>
        <div className="inline-flex rounded-md border p-0.5 gap-0.5" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              title={v.hint}
              onClick={() => applyFilters(search, v.key)}
              className={cn(
                "px-3 py-1 text-sm rounded-sm transition-colors",
                view === v.key
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {viewCounts[v.key]}
              </span>
            </button>
          ))}
        </div>
        {/* Downloads whatever is pending in the current tab and search */}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => handleDownloadGroup({ files: filteredMods })}
          disabled={toDownload(filteredMods).length === 0}
          title="Open download pages for updates in this view that aren't downloaded yet"
        >
          <DownloadIcon />
          Download updates ({toDownload(filteredMods).length})
        </Button>
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
            <SortableHeader field="update_available">Status</SortableHeader>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {authorGroups.map((authorGroup) => {
            const authorExpanded = isAuthorExpanded(authorGroup.author);
            const authorUpdates = authorGroup.files.filter((m) => m.update_available).length;
            const authorReady = downloadedIds(authorGroup.files);
            const authorToDownload = toDownload(authorGroup.files).length;
            return (
              <Fragment key={`author-${authorGroup.author}`}>
                {/* Author group header */}
                <TableRow
                  className="bg-muted hover:bg-muted cursor-pointer"
                  onClick={() => toggleAuthor(authorGroup.author)}
                >
                  <TableCell colSpan={3} className="py-2">
                    <div className="flex items-center gap-2">
                      {authorExpanded ? (
                        <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <UserIcon className="size-4 text-muted-foreground shrink-0" />
                      <span className="font-semibold">{authorGroup.author}</span>
                      <span className="text-xs text-muted-foreground">
                        {authorGroup.mods.length} mod{authorGroup.mods.length !== 1 ? "s" : ""} ·{" "}
                        {authorGroup.files.length} file{authorGroup.files.length !== 1 ? "s" : ""}
                      </span>
                      <GroupSummary
                        updates={authorUpdates}
                        ready={authorReady.length}
                        installed={sumInstalled(authorGroup.files)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <MoreHorizontalIcon />
                          <span className="sr-only">Author Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCheckGroup(authorGroup)}>
                          <RefreshCwIcon />
                          Check Updates
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownloadGroup(authorGroup)}
                          disabled={authorToDownload === 0}
                        >
                          <DownloadIcon />
                          Download Updates ({authorToDownload})
                        </DropdownMenuItem>
                        {onFluffyUpdate && (
                          <DropdownMenuItem
                            onClick={() => onFluffyUpdate(authorReady)}
                            disabled={fluffyBusy || authorReady.length === 0}
                          >
                            <PackageCheckIcon />
                            Update in Fluffy ({authorReady.length})
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {authorExpanded && authorGroup.mods.map((group) => {
                  const ready = downloadedIds(group.files);
                  const pending = toDownload(group.files).length;
                  return (
                  <Fragment key={`group-${group.modId}`}>
                    {/* Mod group header */}
                    <TableRow
                      className="bg-muted/50 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleModGroup(group.modId)}
                    >
                      <TableCell colSpan={3} className="py-2 pl-6">
                        <div className="flex items-center gap-2">
                          {isGroupExpanded(group.modId) ? (
                            <ChevronDownIcon className="size-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
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
                            {group.files.length} file{group.files.length !== 1 ? "s" : ""}
                          </span>
                          <GroupSummary
                            updates={group.files.filter((m) => m.update_available).length}
                            ready={ready.length}
                            installed={sumInstalled(group.files)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {pending > 0 && (
                            <Button variant="outline" size="xs" onClick={() => handleDownloadGroup(group)}>
                              <DownloadIcon />
                              Download{pending > 1 ? ` ${pending}` : ""}
                            </Button>
                          )}
                          {onFluffyUpdate && ready.length > 0 && (
                            <Button
                              size="xs"
                              onClick={() => onFluffyUpdate(ready)}
                              disabled={fluffyBusy}
                            >
                              <PackageCheckIcon />
                              Update in Fluffy{ready.length > 1 ? ` ${ready.length}` : ""}
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-xs">
                                <MoreHorizontalIcon />
                                <span className="sr-only">Group Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleCheckGroup(group)}>
                                <RefreshCwIcon />
                                Check Update
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* File rows */}
                    {isGroupExpanded(group.modId) && group.files.map((mod) => (
                      <TableRow key={mod.id}>
                        <TableCell className="max-w-[520px] pl-12">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/mods/${mod.id}`}
                              className="hover:underline text-foreground font-medium block truncate"
                              title={mod.local_file}
                            >
                              {mod.name || mod.local_file}
                            </Link>
                            {mod.file_exists === false && (
                              <span className="text-destructive shrink-0" title="Local file missing from disk">
                                <AlertTriangleIcon className="size-3.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {mod.version || "—"}
                          </code>
                          {!!mod.update_available && mod.latest_version && (
                            <>
                              <ArrowRightIcon className="inline size-3 mx-1 text-muted-foreground" />
                              <code className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                                {mod.latest_version}
                              </code>
                            </>
                          )}
                        </TableCell>
                        <TableCell
                          title={
                            mod.last_checked
                              ? `Last checked ${formatRelativeDate(mod.last_checked)} (${format(parseServerDate(mod.last_checked), "PPpp")})`
                              : "Never checked"
                          }
                        >
                          <div className="flex items-center gap-2 text-xs">
                            {!mod.update_available ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <CircleCheckIcon className="size-3.5" />
                                Up to date
                              </span>
                            ) : isDownloaded(mod) ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/60 text-emerald-600 dark:text-emerald-400"
                                title={fluffy?.get(mod.id)?.new_archive ?? undefined}
                              >
                                <PackageCheckIcon />
                                Ready
                              </Badge>
                            ) : mod.latest_file_id ? (
                              <a
                                href={getNexusmodsDownloadUrl(mod.game, mod.mod_id, mod.latest_file_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/60 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                >
                                  <DownloadIcon />
                                  Download
                                </Badge>
                              </a>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">Update</span>
                            )}
                            {installedOf(mod) > 0 && (
                              <span className="text-muted-foreground">
                                {installedOf(mod)} in Fluffy
                              </span>
                            )}
                          </div>
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
                              <DropdownMenuItem onClick={() => handleCheckFile(mod)}>
                                <RefreshCwIcon />
                                Check Update
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
                  );
                })}
              </Fragment>
            );
          })}
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
