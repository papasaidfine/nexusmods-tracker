"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { modsApi, nexusmodsApi, configApi } from "@/lib/api";
import type { NexusmodsMod, NexusmodsFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlusIcon, Loader2Icon, SearchIcon, DownloadIcon, CheckCircleIcon } from "lucide-react";

interface AddModDialogProps {
  onModAdded: () => void;
}

type Step = 1 | 2 | 3;

export function AddModDialog({ onModAdded }: AddModDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [game, setGame] = useState("");
  const [modIdInput, setModIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modInfo, setModInfo] = useState<NexusmodsMod | null>(null);
  const [files, setFiles] = useState<NexusmodsFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [results, setResults] = useState<{ file: NexusmodsFile; success: boolean; error?: string }[]>([]);

  // Load game config on mount
  useEffect(() => {
    configApi.get().then((cfg) => setGame(cfg.game)).catch(() => {});
  }, []);

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setStep(1);
      setModIdInput("");
      setModInfo(null);
      setFiles([]);
      setSelectedFileIds(new Set());
      setResults([]);
    }
  };

  // Step 1: Look up mod
  const handleLookup = async () => {
    const modId = parseInt(modIdInput);
    if (!modId || modId <= 0) {
      toast.error("Please enter a valid mod ID");
      return;
    }
    setLoading(true);
    try {
      const [mod, allFiles] = await Promise.all([
        nexusmodsApi.getMod(game, modId),
        nexusmodsApi.getFiles(game, modId),
      ]);
      setModInfo(mod);
      // Filter to MAIN and OPTIONAL only
      const filtered = allFiles.filter(
        (f) => f.category_name === "MAIN" || f.category_name === "OPTIONAL"
      );
      setFiles(filtered);
      // Pre-check MAIN files
      const mainIds = new Set(
        filtered.filter((f) => f.category_name === "MAIN").map((f) => f.file_id)
      );
      setSelectedFileIds(mainIds);
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to look up mod");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Toggle file selection
  const toggleFile = (fileId: number) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // Step 2: Download selected files
  const handleDownload = () => {
    const selectedFiles = files.filter((f) => selectedFileIds.has(f.file_id));
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    for (const file of selectedFiles) {
      const url = `https://www.nexusmods.com/${game}/mods/${modInfo!.mod_id}?tab=files&file_id=${file.file_id}`;
      window.open(url, "_blank");
    }
    setStep(3);
  };

  // Step 3: Register selected files
  const handleRegister = async () => {
    const selectedFiles = files.filter((f) => selectedFileIds.has(f.file_id));
    setRegistering(true);
    const newResults: typeof results = [];
    for (const file of selectedFiles) {
      try {
        await modsApi.create({
          mod_id: modInfo!.mod_id,
          file_id: file.file_id,
          game,
          local_file: file.file_name,
        });
        newResults.push({ file, success: true });
      } catch (error) {
        newResults.push({
          file,
          success: false,
          error: error instanceof Error ? error.message : "Failed",
        });
      }
    }
    setResults(newResults);
    setRegistering(false);

    const successCount = newResults.filter((r) => r.success).length;
    if (successCount > 0) {
      toast.success(`Registered ${successCount} file(s)`);
      onModAdded();
    }
    if (newResults.some((r) => !r.success)) {
      toast.error("Some files failed to register");
    } else {
      // All succeeded — close after a brief delay
      setTimeout(() => handleOpenChange(false), 1000);
    }
  };

  const formatSize = (kb: number) => {
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          Add Mod
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Mod</DialogTitle>
          <DialogDescription>
            {step === 1 && "Enter a Nexusmods mod ID to look up available files."}
            {step === 2 && "Select files to download and register."}
            {step === 3 && "Registering selected files..."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter Mod ID */}
        {step === 1 && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mod_id">Mod ID</Label>
              <div className="flex gap-2">
                <Input
                  id="mod_id"
                  type="number"
                  placeholder="e.g. 1540"
                  value={modIdInput}
                  onChange={(e) => setModIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                />
                <Button onClick={handleLookup} disabled={loading}>
                  {loading ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
                  Look Up
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Game: <Badge variant="secondary">{game || "loading..."}</Badge>
            </p>
          </div>
        )}

        {/* Step 2: Select Files */}
        {step === 2 && modInfo && (
          <div className="grid gap-4">
            <div className="text-sm">
              <span className="font-medium">{modInfo.name}</span>
              <span className="text-muted-foreground"> by {modInfo.author}</span>
            </div>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">No downloadable files found.</p>
            ) : (
              <div className="max-h-80 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow key={file.file_id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedFileIds.has(file.file_id)}
                            onChange={() => toggleFile(file.file_id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{file.name}</TableCell>
                        <TableCell>{file.version}</TableCell>
                        <TableCell>
                          <Badge variant={file.category_name === "MAIN" ? "default" : "secondary"}>
                            {file.category_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatSize(file.size_kb)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleDownload} disabled={selectedFileIds.size === 0}>
                <DownloadIcon />
                Download Selected
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Register */}
        {step === 3 && (
          <div className="grid gap-4">
            {results.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Download the files in your browser, then click below to register them.
                </p>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button onClick={handleRegister} disabled={registering}>
                    {registering ? <Loader2Icon className="animate-spin" /> : <CheckCircleIcon />}
                    {registering ? "Registering..." : "Done & Register"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                {results.map((r) => (
                  <div key={r.file.file_id} className="flex items-center justify-between text-sm">
                    <span>{r.file.name}</span>
                    {r.success ? (
                      <Badge variant="default">Registered</Badge>
                    ) : (
                      <Badge variant="destructive">{r.error}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
