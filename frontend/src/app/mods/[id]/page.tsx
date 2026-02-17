"use client";

import { use, useState } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useMod } from "@/hooks/use-mods";
import { checkSingleUpdate } from "@/hooks/use-updates";
import { modsApi, downloadsApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { UpdateBadge } from "@/components/mods/update-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "PPpp");
  } catch {
    return "—";
  }
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return "";
  }
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start py-3 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

export default function ModDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const modId = parseInt(id);
  const router = useRouter();
  const { mod, isLoading, isError, mutate } = useMod(modId);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await downloadsApi.downloadUpdate(modId);
      toast.success(`Downloaded: ${result.filename}`);
      mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const result = await checkSingleUpdate(modId);
      if (result.update_available) {
        toast.success(`Update available: ${result.latest_version}`);
      } else {
        toast.info("This mod is up to date");
      }
      mutate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to check for updates"
      );
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await modsApi.delete(modId);
      toast.success(`Deleted ${mod?.name || mod?.local_file}`);
      router.push("/mods");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete mod"
      );
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !mod) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive font-medium">Mod not found</p>
        <Button variant="outline" asChild>
          <Link href="/mods">
            <ArrowLeftIcon />
            Back to Mods
          </Link>
        </Button>
      </div>
    );
  }

  const nexusUrl = `https://www.nexusmods.com/${mod.game}/mods/${mod.mod_id}?tab=files&file_id=${mod.file_id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/mods">
            <ArrowLeftIcon />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {mod.name || mod.local_file}
          </h1>
          {mod.mod_name && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {mod.mod_name}{mod.author && ` · by ${mod.author}`}
            </p>
          )}
        </div>
        <UpdateBadge updateAvailable={mod.update_available} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mod Information</CardTitle>
            <CardDescription>Core details from Nexusmods</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow label="Mod ID">{mod.mod_id}</DetailRow>
            <DetailRow label="File ID">{mod.file_id}</DetailRow>
            <DetailRow label="Game">{mod.game}</DetailRow>
            <DetailRow label="Category">{mod.category_name || "—"}</DetailRow>
            <DetailRow label="Current Version">
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                {mod.version || "—"}
              </code>
            </DetailRow>
            <DetailRow label="Local File">
              <span className="font-mono text-xs">{mod.local_file}</span>
            </DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tracking Details</CardTitle>
            <CardDescription>Timestamps and status</CardDescription>
          </CardHeader>
          <CardContent>
            <DetailRow label="Uploaded">
              <div className="text-right">
                <div>{formatDate(mod.uploaded_time)}</div>
                {mod.uploaded_time && (
                  <div className="text-xs text-muted-foreground">
                    {formatRelative(mod.uploaded_time)}
                  </div>
                )}
              </div>
            </DetailRow>
            <DetailRow label="Last Checked">
              <div className="text-right">
                <div>{formatDate(mod.last_checked)}</div>
                {mod.last_checked && (
                  <div className="text-xs text-muted-foreground">
                    {formatRelative(mod.last_checked)}
                  </div>
                )}
              </div>
            </DetailRow>
            <DetailRow label="Tracked Since">
              <div className="text-right">
                <div>{formatDate(mod.created_at)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatRelative(mod.created_at)}
                </div>
              </div>
            </DetailRow>
            <DetailRow label="Last Updated">
              <div className="text-right">
                <div>{formatDate(mod.updated_at)}</div>
                <div className="text-xs text-muted-foreground">
                  {formatRelative(mod.updated_at)}
                </div>
              </div>
            </DetailRow>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        {mod.update_available && (
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            {downloading ? "Downloading…" : "Download Update"}
          </Button>
        )}
        <Button variant="outline" onClick={handleCheckUpdate} disabled={checking}>
          {checking ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <RefreshCwIcon />
          )}
          {checking ? "Checking..." : "Check for Updates"}
        </Button>
        <Button variant="outline" asChild>
          <a href={nexusUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            View on Nexusmods
          </a>
        </Button>
        <Button
          variant="destructive"
          onClick={() => setShowDelete(true)}
        >
          <Trash2Icon />
          Delete
        </Button>
      </div>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Mod</DialogTitle>
            <DialogDescription>
              Are you sure you want to stop tracking{" "}
              <span className="font-medium text-foreground">
                {mod.name || mod.local_file}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDelete(false)}
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
    </div>
  );
}
