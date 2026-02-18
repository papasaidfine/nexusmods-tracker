"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { localFilesApi } from "@/lib/api";
import type { LocalFile, Mod } from "@/lib/types";
import { formatFileSize } from "@/lib/utils";
import { MapFileDialog } from "@/components/local-files/map-file-dialog";
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
import { Input } from "@/components/ui/input";
import {
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  EyeIcon,
  FileArchiveIcon,
  LinkIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

interface FileListProps {
  files: LocalFile[];
  mods: Mod[];
  onMutate: () => void;
}

type SortField = "filename" | "size_bytes" | "mapped";
type SortDirection = "asc" | "desc";
type FilterMode = "all" | "mapped" | "unmapped";

export function FileList({ files, mods, onMutate }: FileListProps) {
  const [sortField, setSortField] = useState<SortField>("filename");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [mapTarget, setMapTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const modsByFile = new Map<string, Mod>();
  for (const mod of mods) {
    modsByFile.set(mod.local_file, mod);
  }

  const searchLower = search.toLowerCase();
  const filteredFiles = files.filter((f) => {
    if (search && !f.filename.toLowerCase().includes(searchLower)) return false;
    if (filter === "mapped") return f.mapped;
    if (filter === "unmapped") return !f.mapped;
    return true;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;

    if (sortField === "mapped") {
      return (Number(a.mapped) - Number(b.mapped)) * dir;
    }
    if (sortField === "size_bytes") {
      return (a.size_bytes - b.size_bytes) * dir;
    }
    return a.filename.localeCompare(b.filename) * dir;
  });

  const mappedCount = files.filter((f) => f.mapped).length;
  const unmappedCount = files.length - mappedCount;

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

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileArchiveIcon className="size-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">No local files found</p>
        <p className="text-sm mt-1">
          Click &quot;Scan Directory&quot; to discover files in your mods folder.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
        <div className="relative w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/50">
          {(["all", "mapped", "unmapped"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "all" && `All (${files.length})`}
              {mode === "mapped" && `Mapped (${mappedCount})`}
              {mode === "unmapped" && `Unmapped (${unmappedCount})`}
            </button>
          ))}
        </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {filteredFiles.length} of {files.length} files
        </p>
      </div>

      {/* File table */}
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader field="filename">Filename</SortableHeader>
            <SortableHeader field="size_bytes">Size</SortableHeader>
            <SortableHeader field="mapped">Status</SortableHeader>
            <TableHead>Linked Mod</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedFiles.map((file) => {
            const linkedMod = modsByFile.get(file.filename);
            return (
              <TableRow
                key={file.path}
                className={
                  file.mapped
                    ? ""
                    : "bg-muted/30 dark:bg-muted/10"
                }
              >
                <TableCell className="font-medium max-w-[300px]">
                  <div className="flex items-center gap-2">
                    <FileArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate" title={file.filename}>
                      {file.filename}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatFileSize(file.size_bytes)}
                </TableCell>
                <TableCell>
                  {file.mapped ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                    >
                      <CheckCircle2Icon className="size-3" />
                      Mapped
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20"
                    >
                      <CircleDotIcon className="size-3" />
                      Unmapped
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {linkedMod ? (
                    <Link
                      href={`/mods/${linkedMod.id}`}
                      className="text-sm hover:underline text-foreground"
                    >
                      {linkedMod.mod_name || `Mod ${linkedMod.mod_id}`}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {file.mapped && linkedMod ? (
                      <Button variant="ghost" size="xs" asChild>
                        <Link href={`/mods/${linkedMod.id}`}>
                          <EyeIcon />
                          View Mod
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setMapTarget(file.filename)}
                      >
                        <LinkIcon />
                        Map File
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={async () => {
                        try {
                          await localFilesApi.delete(file.filename);
                          toast.success(`Deleted ${file.filename}`);
                          onMutate();
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : "Failed to delete");
                        }
                      }}
                    >
                      <Trash2Icon className="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {filteredFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-sm">
            No {filter === "mapped" ? "mapped" : "unmapped"} files found.
          </p>
        </div>
      )}

      <MapFileDialog
        filename={mapTarget}
        open={mapTarget !== null}
        onOpenChange={(open) => !open && setMapTarget(null)}
        onMapped={onMutate}
      />
    </>
  );
}
