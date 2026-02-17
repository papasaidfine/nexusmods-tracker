"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLocalFiles, scanDirectory } from "@/hooks/use-local-files";
import { useMods } from "@/hooks/use-mods";
import { FileList } from "@/components/local-files/file-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ScanSearchIcon,
  Loader2Icon,
  HardDriveIcon,
  FileArchiveIcon,
  LinkIcon,
  CircleDotIcon,
} from "lucide-react";

export default function LocalFilesPage() {
  const { files, isLoading, isError, mutate: mutateFiles } = useLocalFiles();
  const { mods, mutate: mutateMods } = useMods();
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanDirectory();
      toast.success(
        `Scan complete: ${result.total_files} files found (${result.mapped_files} mapped, ${result.unmapped_files} unmapped)`
      );
      mutateFiles();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to scan directory"
      );
    } finally {
      setScanning(false);
    }
  };

  const handleMutate = () => {
    mutateFiles();
    mutateMods();
  };

  const mappedCount = files?.filter((f) => f.mapped).length ?? 0;
  const unmappedCount = (files?.length ?? 0) - mappedCount;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Local Files</h1>
          <p className="text-muted-foreground">
            Manage local mod files and map them to Nexusmods
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <ScanSearchIcon />
          )}
          {scanning ? "Scanning..." : "Scan Directory"}
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <HardDriveIcon className="size-4" />
              Total Files
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {isLoading ? "—" : (files?.length ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Archive files in mods directory
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <LinkIcon className="size-4" />
              Mapped
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-600 dark:text-emerald-400">
              {isLoading ? "—" : mappedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Linked to Nexusmods entries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CircleDotIcon className="size-4" />
              Unmapped
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums text-amber-600 dark:text-amber-400">
              {isLoading ? "—" : unmappedCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Not yet linked to a mod
            </p>
          </CardContent>
        </Card>
      </div>

      {/* File list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileArchiveIcon className="size-5" />
            Files
          </CardTitle>
          <CardDescription>
            All archive files discovered in your mods directory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-destructive">
              <p className="text-lg font-medium">Failed to load files</p>
              <p className="text-sm mt-1 text-muted-foreground">
                Make sure the backend server is running.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => mutateFiles()}
              >
                Retry
              </Button>
            </div>
          ) : (
            <FileList
              files={files ?? []}
              mods={mods ?? []}
              onMutate={handleMutate}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
