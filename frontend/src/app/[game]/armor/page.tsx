"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2Icon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { useArmor } from "@/hooks/use-armor";
import { useGame } from "@/hooks/use-game";
import { cn } from "@/lib/utils";
import { ArmorModelCard, changesLook } from "@/components/armor/armor-model-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ArmorModel, ArmorOther, ArmorSlotOption } from "@/lib/types";

type Body = "all" | "female" | "male";

const BODIES: Array<{ key: Body; label: string }> = [
  { key: "all", label: "Both bodies" },
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
];

const CATEGORIES: Record<ArmorOther["category"], string> = {
  pak: "Pak files (textures etc.)",
  palico: "Palico",
  weapon: "Weapons",
  reframework: "REFramework",
  other: "Other",
};

interface Filters {
  search: string;
  body: Body;
  looksOnly: boolean;
  overwrittenOnly: boolean;
}

/** Models narrowed to matching options; slots, looks and models left empty are dropped */
function filterModels(models: ArmorModel[], f: Filters): ArmorModel[] {
  const q = f.search.trim().toLowerCase();
  const keep = (e: ArmorSlotOption) =>
    (f.body === "all" || e.bodies.includes(f.body)) && (!f.looksOnly || changesLook(e));

  return models.flatMap((m) => {
    const modelText = [m.model, ...m.series.flatMap((s) => [s.zh, s.en])].join(" ").toLowerCase();
    const variants = m.variants.flatMap((v) => {
      const lookMatches = !q || modelText.includes(q) || (v.label ?? "").toLowerCase().includes(q);
      const parts = Object.fromEntries(
        Object.entries(v.parts)
          .map(([part, entries]) => {
            let kept = entries!.filter(keep);
            if (f.overwrittenOnly && !kept.some((e) => e.owned_files < e.files)) kept = [];
            if (!lookMatches) {
              const hit = kept.some((e) =>
                [e.section, e.mod_name ?? "", e.archive ?? ""].join(" ").toLowerCase().includes(q)
              );
              if (!hit) kept = [];
            }
            return [part, kept] as const;
          })
          .filter(([, kept]) => kept.length > 0)
      );
      return Object.keys(parts).length ? [{ ...v, parts }] : [];
    });
    return variants.length ? [{ ...m, variants }] : [];
  });
}

export default function ArmorPage() {
  const game = useGame();
  const { armor, isLoading, isError, mutate } = useArmor();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    body: "all",
    looksOnly: false,
    overwrittenOnly: false,
  });
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const models = useMemo(() => filterModels(armor?.models ?? [], filters), [armor, filters]);
  const others = useMemo(() => {
    const groups = new Map<ArmorOther["category"], ArmorOther[]>();
    for (const o of armor?.others ?? []) groups.set(o.category, [...(groups.get(o.category) ?? []), o]);
    return groups;
  }, [armor]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !armor) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-destructive font-medium">
          {isError instanceof Error ? isError.message : "Failed to load armor"}
        </p>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCwIcon />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Armor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Which installed options replace which armor, read from Fluffy. In each slot the
          option installed last wins a shared file:{" "}
          <span className="font-medium text-foreground">bold</span> is the look in game,{" "}
          <span className="line-through">struck</span> options lost all their files.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Armor, option or mod..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="pl-9 h-8"
          />
        </div>
        <div className="inline-flex rounded-md border p-0.5 gap-0.5" role="tablist">
          {BODIES.map((b) => (
            <button
              key={b.key}
              role="tab"
              aria-selected={filters.body === b.key}
              title="Hunter body the option has files for (ch03 female, ch02 male)"
              onClick={() => set({ body: b.key })}
              className={cn(
                "px-3 py-1 text-sm rounded-sm transition-colors",
                filters.body === b.key
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.looksOnly}
            onChange={(e) => set({ looksOnly: e.target.checked })}
          />
          Hide physics-only options
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.overwrittenOnly}
            onChange={(e) => set({ overwrittenOnly: e.target.checked })}
          />
          Only slots with overwritten files
        </label>
        <span className="ml-auto text-sm text-muted-foreground">
          {models.length} of {armor.models.length} armor models
        </span>
      </div>

      <div className="space-y-4">
        {models.map((m) => (
          <ArmorModelCard key={m.model} model={m} onChanged={() => mutate()} />
        ))}
        {models.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No armor matches.</p>
        )}
      </div>

      {armor.others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Other installed options</CardTitle>
            <CardDescription>
              {armor.others.length} option{armor.others.length === 1 ? "" : "s"} that replace no armor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...others.entries()].map(([category, options]) => (
              <div key={category}>
                <h3 className="mb-1 text-sm font-medium">
                  {CATEGORIES[category]}{" "}
                  <span className="text-xs text-muted-foreground tabular-nums">{options.length}</span>
                </h3>
                <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                  {options.map((o) => (
                    <li key={o.position} className="truncate text-xs leading-5" title={[o.section, o.mod_name, o.archive].filter(Boolean).join("\n")}>
                      {o.mod_db_id ? (
                        <Link href={`/${game}/mods/${o.mod_db_id}`} className="hover:underline">
                          {o.section}
                        </Link>
                      ) : (
                        o.section
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
