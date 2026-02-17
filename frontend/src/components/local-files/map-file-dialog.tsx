"use client";

import { useState } from "react";
import { toast } from "sonner";
import { modsApi } from "@/lib/api";
import type { ModCreate } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon, LinkIcon } from "lucide-react";

interface MapFileDialogProps {
  filename: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMapped: () => void;
}

export function MapFileDialog({
  filename,
  open,
  onOpenChange,
  onMapped,
}: MapFileDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    mod_id: 0,
    file_id: 0,
    game: "monsterhunterwilds",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.mod_id || !formData.file_id || !filename) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload: ModCreate = {
        local_file: filename,
        mod_id: formData.mod_id,
        file_id: formData.file_id,
        game: formData.game,
      };
      await modsApi.create(payload);
      toast.success(`Mapped "${filename}" successfully`);
      onOpenChange(false);
      setFormData({ mod_id: 0, file_id: 0, game: "monsterhunterwilds" });
      onMapped();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to map file"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-5" />
            Map File to Nexusmods
          </DialogTitle>
          <DialogDescription>
            Link this local file to a mod on Nexusmods. The mod metadata will be
            fetched automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="map_local_file">Local File</Label>
            <Input
              id="map_local_file"
              value={filename || ""}
              disabled
              className="bg-muted text-muted-foreground"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="map_mod_id">Mod ID *</Label>
            <Input
              id="map_mod_id"
              type="number"
              placeholder="e.g. 12345"
              value={formData.mod_id || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  mod_id: parseInt(e.target.value) || 0,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Found in the Nexusmods URL: nexusmods.com/game/mods/<span className="font-semibold text-foreground">12345</span>
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="map_file_id">File ID *</Label>
            <Input
              id="map_file_id"
              type="number"
              placeholder="e.g. 67890"
              value={formData.file_id || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  file_id: parseInt(e.target.value) || 0,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Found on the mod&apos;s Files tab on Nexusmods
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="map_game">Game</Label>
            <Input
              id="map_game"
              placeholder="e.g. monsterhunterwilds"
              value={formData.game}
              onChange={(e) =>
                setFormData({ ...formData, game: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              The game slug from the Nexusmods URL
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2Icon className="animate-spin" />}
              {submitting ? "Mapping..." : "Map File"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
