"use client";

import { Fragment, useState, useEffect } from "react";
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

interface ModFile extends NexusmodsFile {
  mod_id: number;
}

interface LookedUpMod {
  info: NexusmodsMod;
  files: ModFile[];
}

type Step = 1 | 2 | 3;

type RegResult = { file: ModFile; success: boolean; error?: string };

export function AddModDialog({ onModAdded }: AddModDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [game, setGame] = useState("");
  const [modIdInput, setModIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState<LookedUpMod[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [registering, setRegistering] = useState(false);
  const [results, setResults] = useState<RegResult[]>([]);

  useEffect(() => {
    configApi.get().then((cfg) => setGame(cfg.game)).catch(() => {});
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setStep(1);
      setModIdInput("");
      setLookedUp([]);
      setSelectedKeys(new Set());
      setResults([]);
    }
  };

  const fileKey = (modId: number, fileId: number) => `${modId}:${fileId}`;

  // Step 1: Look up mods
  const handleLookup = async () => {
    const ids = modIdInput
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim()))
      .filter((n) => n > 0);

    if (ids.length === 0) {
      toast.error("Please enter at least one valid mod ID");
      return;
    }

    setLoading(true);
    const newMods: LookedUpMod[] = [];
    const preChecked = new Set<string>();
    const errors: string[] = [];

    await Promise.all(
      ids.map(async (modId) => {
        try {
          const [mod, allFiles] = await Promise.all([
            nexusmodsApi.getMod(game, modId),
            nexusmodsApi.getFiles(game, modId),
          ]);
          const filtered: ModFile[] = allFiles
            .filter((f) => f.category_name === "MAIN" || f.category_name === "OPTIONAL")
            .map((f) => ({ ...f, mod_id: modId }));
          newMods.push({ info: mod, files: filtered });
          for (const f of filtered) {
            if (f.category_name === "MAIN") {
              preChecked.add(fileKey(modId, f.file_id));
            }
          }
        } catch {
          errors.push(`Mod ${modId} not found`);
        }
      })
    );

    if (errors.length > 0) {
      toast.error(errors.join(", "));
    }

    if (newMods.length > 0) {
      // Sort by mod_id for stable ordering
      newMods.sort((a, b) => a.info.mod_id - b.info.mod_id);
      setLookedUp(newMods);
      setSelectedKeys(preChecked);
      setStep(2);
    }
    setLoading(false);
  };

  const toggleFile = (modId: number, fileId: number) => {
    const key = fileKey(modId, fileId);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectionState = (files: ModFile[]): "all" | "some" | "none" => {
    if (files.length === 0) return "none";
    let selected = 0;
    for (const f of files) {
      if (selectedKeys.has(fileKey(f.mod_id, f.file_id))) selected++;
    }
    if (selected === 0) return "none";
    if (selected === files.length) return "all";
    return "some";
  };

  const toggleAll = () => {
    const files = allFiles();
    const state = selectionState(files);
    setSelectedKeys(() => {
      if (state === "all") return new Set();
      return new Set(files.map((f) => fileKey(f.mod_id, f.file_id)));
    });
  };

  const toggleMod = (modId: number) => {
    const mod = lookedUp.find((m) => m.info.mod_id === modId);
    if (!mod) return;
    const state = selectionState(mod.files);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (state === "all") {
        for (const f of mod.files) next.delete(fileKey(f.mod_id, f.file_id));
      } else {
        for (const f of mod.files) next.add(fileKey(f.mod_id, f.file_id));
      }
      return next;
    });
  };

  const setIndeterminate = (state: "all" | "some" | "none") => (el: HTMLInputElement | null) => {
    if (el) el.indeterminate = state === "some";
  };

  const handleDownload = () => {
    const selected = allFiles().filter((f) => selectedKeys.has(fileKey(f.mod_id, f.file_id)));
    if (selected.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    for (const file of selected) {
      const url = `https://www.nexusmods.com/${game}/mods/${file.mod_id}?tab=files&file_id=${file.file_id}`;
      window.open(url, "_blank");
    }
    setStep(3);
  };

  const handleRegister = async () => {
    const selected = allFiles().filter((f) => selectedKeys.has(fileKey(f.mod_id, f.file_id)));
    setRegistering(true);
    const newResults: RegResult[] = [];
    for (const file of selected) {
      try {
        await modsApi.create({
          mod_id: file.mod_id,
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
      setTimeout(() => handleOpenChange(false), 1000);
    }
  };

  const allFiles = () => lookedUp.flatMap((m) => m.files);

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
            {step === 1 && "Enter one or more Nexusmods mod IDs (comma or space separated)."}
            {step === 2 && "Select files to download and register."}
            {step === 3 && "Registering selected files..."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Enter Mod IDs */}
        {step === 1 && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="mod_ids">Mod IDs</Label>
              <div className="flex gap-2">
                <Input
                  id="mod_ids"
                  placeholder="e.g. 1540, 2100, 983"
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
        {step === 2 && lookedUp.length > 0 && (
          <div className="grid gap-4">
            {allFiles().length === 0 ? (
              <p className="text-sm text-muted-foreground">No downloadable files found.</p>
            ) : (
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all files"
                          title="Select all / deselect all"
                          checked={selectionState(allFiles()) === "all"}
                          ref={setIndeterminate(selectionState(allFiles()))}
                          onChange={toggleAll}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lookedUp.map((mod) => {
                      const modState = selectionState(mod.files);
                      return (
                      <Fragment key={mod.info.mod_id}>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell className="py-1.5">
                            <input
                              type="checkbox"
                              aria-label={`Select all files for ${mod.info.name}`}
                              title="Select all / deselect all for this mod"
                              checked={modState === "all"}
                              ref={setIndeterminate(modState)}
                              onChange={() => toggleMod(mod.info.mod_id)}
                              className="h-4 w-4 rounded border-gray-300"
                              disabled={mod.files.length === 0}
                            />
                          </TableCell>
                          <TableCell colSpan={4} className="py-1.5">
                            <span className="font-medium">{mod.info.name}</span>
                            <span className="text-muted-foreground"> by {mod.info.author}</span>
                          </TableCell>
                        </TableRow>
                        {mod.files.map((file) => (
                          <TableRow key={file.file_id}>
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedKeys.has(fileKey(file.mod_id, file.file_id))}
                                onChange={() => toggleFile(file.mod_id, file.file_id)}
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
                      </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {selectedKeys.size} of {allFiles().length} selected
                </span>
                <Button onClick={handleDownload} disabled={selectedKeys.size === 0}>
                  <DownloadIcon />
                  Download Selected
                </Button>
              </div>
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
                  <div key={`${r.file.mod_id}:${r.file.file_id}`} className="flex items-center justify-between text-sm">
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
