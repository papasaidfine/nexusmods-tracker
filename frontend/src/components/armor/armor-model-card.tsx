"use client";

import { useState } from "react";
import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { armorApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useGame } from "@/hooks/use-game";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ArmorModel, ArmorPart, ArmorSlotOption, ArmorVariant } from "@/lib/types";

export const PARTS: Array<{ key: ArmorPart; label: string }> = [
  { key: "helm", label: "Helm" },
  { key: "body", label: "Body" },
  { key: "arm", label: "Arms" },
  { key: "waist", label: "Waist" },
  { key: "leg", label: "Legs" },
  { key: "slinger", label: "Slinger" },
];

/** Series names without their rank suffix: 锁刃龙α, 锁刃龙γ -> 锁刃龙 */
export function baseNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.replace(/\s*[αβγ]$/, "")))];
}

export const changesLook = (e: ArmorSlotOption) =>
  e.roles.includes("mesh") || e.roles.includes("material");

/** The option whose look is in the game: the last installed one that still owns files */
function winner(entries: ArmorSlotOption[]): ArmorSlotOption | undefined {
  return entries.filter((e) => changesLook(e) && e.owned_files > 0).at(-1);
}

function SlotEntry({ entry, wins }: { entry: ArmorSlotOption; wins: boolean }) {
  const game = useGame();
  const look = changesLook(entry);
  const lost = entry.files - entry.owned_files;
  const title = [
    entry.section,
    entry.mod_name && `Mod: ${entry.mod_name}`,
    entry.archive && `Archive: ${entry.archive}`,
    `Changes: ${entry.roles.join(", ")} (${entry.bodies.join(" + ")} body)`,
    lost > 0 && `${lost} of ${entry.files} file(s) overwritten by options installed later`,
    `Install position #${entry.position + 1}`,
  ].filter(Boolean).join("\n");

  const text = (
    <span
      title={title}
      className={cn(
        "flex items-start gap-1.5 py-0.5 text-xs leading-4",
        !look && "text-muted-foreground",
        entry.owned_files === 0 && "line-through text-muted-foreground/60",
        wins && "font-medium"
      )}
    >
      <span
        className={cn(
          "mt-1.5 size-1.5 shrink-0 rounded-full",
          entry.owned_files === 0
            ? "bg-muted-foreground/30"
            : lost > 0
              ? "bg-amber-500"
              : look
                ? "bg-emerald-500"
                : "bg-muted-foreground/50"
        )}
      />
      <span className="line-clamp-2 break-words">{entry.section}</span>
      {!look && <span className="shrink-0 text-[10px] uppercase opacity-70">{entry.roles.includes("physics") ? "phys" : "misc"}</span>}
    </span>
  );

  return entry.mod_db_id ? (
    <Link href={`/${game}/mods/${entry.mod_db_id}`} className="block hover:underline">
      {text}
    </Link>
  ) : (
    text
  );
}

function VariantLabel({
  model,
  variant,
  onChanged,
}: {
  model: string;
  variant: ArmorVariant;
  onChanged: () => void;
}) {
  const game = useGame();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(variant.label ?? "");

  const save = async () => {
    setEditing(false);
    if ((variant.label ?? "") === value.trim()) return;
    try {
      await armorApi.setLabel(game, model, variant.variety, value.trim() || null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save the name");
    }
  };

  return (
    <div className="space-y-0.5">
      {editing ? (
        <Input
          autoFocus
          value={value}
          placeholder={`Look ${variant.variety}`}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(variant.label ?? "");
              setEditing(false);
            }
          }}
          className="h-7 text-xs"
        />
      ) : (
        <button
          className="group flex items-center gap-1 text-left text-sm font-medium"
          title="Name this look (applies to both designs)"
          onClick={() => {
            setValue(variant.label ?? "");
            setEditing(true);
          }}
        >
          {variant.label ?? <span className="text-muted-foreground">Look {variant.variety}</span>}
          <PencilIcon className="size-3 opacity-0 group-hover:opacity-60" />
        </button>
      )}
      <div className="text-xs text-muted-foreground">
        {variant.design} design · <span className="font-mono">{variant.variant}</span>
      </div>
    </div>
  );
}

export function ArmorModelCard({ model, onChanged }: { model: ArmorModel; onChanged: () => void }) {
  const parts = PARTS.filter((p) => model.variants.some((v) => v.parts[p.key]?.length));
  const zh = baseNames(model.series.map((s) => s.zh));
  const en = baseNames(model.series.map((s) => s.en));

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-baseline gap-2 text-base">
          <span className="font-mono text-sm text-muted-foreground">{model.model}</span>
          {zh.length ? zh.join(" · ") : <span className="text-muted-foreground">Unknown armor</span>}
        </CardTitle>
        {en.length > 0 && <CardDescription className="text-xs">{en.join(" · ")}</CardDescription>}
      </CardHeader>
      <CardContent className="px-4">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="w-40 pb-1 font-normal">Look</th>
                {parts.map((p) => (
                  <th key={p.key} className="pb-1 font-normal">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.variants.map((v) => (
                <tr key={v.variant} className="border-t align-top">
                  <td className="py-2 pr-3">
                    <VariantLabel model={model.model} variant={v} onChanged={onChanged} />
                  </td>
                  {parts.map((p) => {
                    const entries = v.parts[p.key] ?? [];
                    const top = winner(entries);
                    return (
                      <td key={p.key} className="py-2 pr-3">
                        {entries.length === 0 ? (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        ) : (
                          entries.map((e) => <SlotEntry key={e.position} entry={e} wins={e === top} />)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
