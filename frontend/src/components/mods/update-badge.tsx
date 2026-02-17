"use client";

import { Badge } from "@/components/ui/badge";
import { ArrowUpCircleIcon, CheckCircleIcon } from "lucide-react";

interface UpdateBadgeProps {
  updateAvailable: boolean;
}

export function UpdateBadge({ updateAvailable }: UpdateBadgeProps) {
  if (updateAvailable) {
    return (
      <Badge variant="destructive" className="gap-1">
        <ArrowUpCircleIcon className="size-3" />
        Update Available
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1">
      <CheckCircleIcon className="size-3" />
      Up to Date
    </Badge>
  );
}
