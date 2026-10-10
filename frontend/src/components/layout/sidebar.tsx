"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Settings,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { lastGame, useGame, useGames } from "@/hooks/use-game";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const noSubscription = () => () => {};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const urlGame = useGame();
  const { games } = useGames();
  // Outside game pages (Settings), links go to the last used game
  // (read on every render; null while server rendering)
  const rememberedGame = useSyncExternalStore(noSubscription, lastGame, () => null);
  const game = urlGame || rememberedGame || games?.[0]?.id || "";
  const current = games?.find((g) => g.id === game);

  const navItems = [
    { href: `/${game}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: `/${game}/mods`, label: "Mods", icon: Package },
    ...(current?.armor ? [{ href: `/${game}/armor`, label: "Armor", icon: Shield }] : []),
    { href: `/${game}/local-files`, label: "Local Files", icon: FolderOpen },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  // Keep the section when switching games (not a mod page: IDs are per game)
  const switchGame = (id: string) => {
    const section = urlGame ? pathname.split("/")[2] : undefined;
    const target = games?.find((g) => g.id === id);
    const keep = section === "armor" && !target?.armor ? undefined : section;
    router.push(keep ? `/${id}/${keep}` : `/${id}`);
  };

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href={game ? `/${game}` : "/"} className="flex items-center gap-2">
          <Package className="size-5 text-sidebar-primary" />
          <span className="text-sm font-semibold tracking-tight">
            Nexusmods Tracker
          </span>
        </Link>
      </div>
      {games && games.length > 0 && (
        <div className="border-b border-border p-3">
          <Select value={game} onValueChange={switchGame}>
            <SelectTrigger className="w-full" size="sm">
              <SelectValue placeholder="Game" />
            </SelectTrigger>
            <SelectContent>
              {games.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </div>
    </aside>
  );
}
