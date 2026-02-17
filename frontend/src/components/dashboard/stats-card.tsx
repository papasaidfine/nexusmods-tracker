"use client";

import { Package, ArrowUpCircle, HardDrive, FileQuestion } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
}

const variantStyles = {
  default: "text-primary",
  success: "text-emerald-500",
  warning: "text-amber-500",
  muted: "text-muted-foreground",
};

function StatsCard({ title, value, description, icon, variant = "default" }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-0">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted",
            variantStyles[variant]
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsOverviewProps {
  totalMods: number;
  updatesAvailable: number;
  totalFiles: number;
  unmappedFiles: number;
  isLoading: boolean;
}

export function StatsOverview({
  totalMods,
  updatesAvailable,
  totalFiles,
  unmappedFiles,
  isLoading,
}: StatsOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="size-12 animate-pulse rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="h-7 w-12 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Tracked Mods"
        value={totalMods}
        description={totalMods === 1 ? "1 mod tracked" : `${totalMods} mods tracked`}
        icon={<Package className="size-5" />}
        variant="default"
      />
      <StatsCard
        title="Updates Available"
        value={updatesAvailable}
        description={
          updatesAvailable > 0
            ? `${updatesAvailable} mod${updatesAvailable !== 1 ? "s" : ""} can be updated`
            : "All mods up to date"
        }
        icon={<ArrowUpCircle className="size-5" />}
        variant={updatesAvailable > 0 ? "success" : "muted"}
      />
      <StatsCard
        title="Local Files"
        value={totalFiles}
        description={`${totalFiles - unmappedFiles} mapped`}
        icon={<HardDrive className="size-5" />}
        variant="default"
      />
      <StatsCard
        title="Unmapped Files"
        value={unmappedFiles}
        description={
          unmappedFiles > 0
            ? `${unmappedFiles} file${unmappedFiles !== 1 ? "s" : ""} need mapping`
            : "All files mapped"
        }
        icon={<FileQuestion className="size-5" />}
        variant={unmappedFiles > 0 ? "warning" : "muted"}
      />
    </div>
  );
}
