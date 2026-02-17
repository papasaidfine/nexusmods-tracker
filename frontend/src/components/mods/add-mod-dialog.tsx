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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, Loader2Icon } from "lucide-react";

interface AddModDialogProps {
  onModAdded: () => void;
}

export function AddModDialog({ onModAdded }: AddModDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<ModCreate>({
    mod_id: 0,
    file_id: 0,
    game: "skyrimspecialedition",
    local_file: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.mod_id || !formData.file_id || !formData.local_file) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      await modsApi.create(formData);
      toast.success("Mod added successfully");
      setOpen(false);
      setFormData({
        mod_id: 0,
        file_id: 0,
        game: "skyrimspecialedition",
        local_file: "",
      });
      onModAdded();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add mod"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          Add Mod
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Mod</DialogTitle>
          <DialogDescription>
            Track a new mod from Nexusmods. Enter the mod ID and file ID from
            the mod page URL.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mod_id">Mod ID *</Label>
            <Input
              id="mod_id"
              type="number"
              placeholder="e.g. 12345"
              value={formData.mod_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, mod_id: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="file_id">File ID *</Label>
            <Input
              id="file_id"
              type="number"
              placeholder="e.g. 67890"
              value={formData.file_id || ""}
              onChange={(e) =>
                setFormData({ ...formData, file_id: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="game">Game</Label>
            <Input
              id="game"
              placeholder="e.g. skyrimspecialedition"
              value={formData.game}
              onChange={(e) =>
                setFormData({ ...formData, game: e.target.value })
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="local_file">Local File *</Label>
            <Input
              id="local_file"
              placeholder="e.g. my_mod_v1.0.zip"
              value={formData.local_file}
              onChange={(e) =>
                setFormData({ ...formData, local_file: e.target.value })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2Icon className="animate-spin" />}
              {submitting ? "Adding..." : "Add Mod"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
